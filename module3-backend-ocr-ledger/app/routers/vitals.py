"""
Longitudinal Vitals Baseline & Delta Deviation Detector Router
Module 3 Backend Service
Connects to MongoDB Atlas vitals_baselines, encounters, and care_ledgers collections.
Provides:
- GET /api/v1/vitals/baseline/{person_id}: Retrieve longitudinal baseline & history
- POST /api/v1/vitals/analyze-delta: Compute real-time delta deviation against baseline,
  auto-generate care gaps in MongoDB, and return clinical action recommendations.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from models.schemas import (
    VitalsBaselineSchema,
    VitalsDeltaAnalysisSchema,
    VitalsDeltaRequestSchema,
    HistoricalVitalsPointSchema,
    CareGapSchema
)
from db.database import vitals_baselines_col, encounters_col, care_ledgers_col, households_col, persons_col

router = APIRouter(prefix="/api/v1/vitals", tags=["Vitals Baseline & Delta Engine"])

@router.get("/baseline/{person_id}", response_model=VitalsBaselineSchema)
def get_vitals_baseline(person_id: str):
    """
    Retrieves the longitudinal moving average baseline and past visit sparklines from MongoDB Atlas.
    Dynamically aggregates historical encounters from clinical_encounters and vitals_baselines:
    - History Section: Average of previous readings
    - Today's Reading Section: Today's / latest measurements
    """
    p_name = "Member"
    p_age = None
    p_gender = "female"
    p_hh_id = "h-unknown"

    # 1. Lookup real person metadata from persons_col or households_col
    if persons_col is not None:
        try:
            p_doc = persons_col.find_one({"person_id": person_id}, {"_id": 0})
            if p_doc:
                p_name = p_doc.get("name", "Member")
                p_age = p_doc.get("age")
                p_gender = p_doc.get("gender", "female")
                p_hh_id = p_doc.get("household_id", "h-unknown")
        except Exception as e:
            print(f"[MongoDB Error in person lookup] {e}")

    if p_name == "Member" and households_col is not None:
        try:
            hh_doc = households_col.find_one({"members.person_id": person_id}, {"_id": 0, "id": 1, "members": 1})
            if hh_doc:
                p_hh_id = hh_doc.get("id", p_hh_id)
                for m in hh_doc.get("members", []):
                    if m.get("person_id") == person_id:
                        p_name = m.get("name", p_name)
                        p_age = m.get("age", p_age)
                        p_gender = m.get("gender", p_gender)
                        break
        except Exception as e:
            print(f"[MongoDB Error in household member lookup] {e}")

    # 2. Extract measurements from all clinical_encounters for this person
    encounters_list = []
    if encounters_col is not None:
        try:
            encounters_list = list(encounters_col.find(
                {"$or": [
                    {"person.person_id": person_id},
                    {"person_id": person_id},
                    {"person.id": person_id}
                ]},
                {"_id": 0}
            ).sort("visit.date", 1))
        except Exception as e:
            print(f"[MongoDB Error querying encounters] {e}")

    # 3. Also check vitals_baselines_col for any existing history points
    existing_base_doc = None
    if vitals_baselines_col is not None:
        try:
            existing_base_doc = vitals_baselines_col.find_one({"person_id": person_id}, {"_id": 0})
        except Exception as e:
            print(f"[MongoDB Error fetching existing baseline doc] {e}")

    all_points_map = {}

    # Helper to parse BP
    def parse_bp(bp_val, m_obj):
        sys_val = None
        dia_val = None
        if isinstance(bp_val, dict):
            sys_val = bp_val.get("systolic_mmhg") or bp_val.get("systolic") or bp_val.get("sys")
            dia_val = bp_val.get("diastolic_mmhg") or bp_val.get("diastolic") or bp_val.get("dia")
        elif isinstance(bp_val, str) and "/" in bp_val:
            parts = bp_val.split("/")
            try:
                sys_val = float(parts[0].strip())
                dia_val = float(parts[1].strip())
            except Exception:
                pass
        if sys_val is None:
            sys_val = m_obj.get("blood_pressure_sys") or m_obj.get("systolic_bp") or m_obj.get("systolic")
        if dia_val is None:
            dia_val = m_obj.get("blood_pressure_dia") or m_obj.get("diastolic_bp") or m_obj.get("diastolic")
        return sys_val, dia_val

    # Parse encounters
    for idx, e in enumerate(encounters_list):
        obs = e.get("observations", {}) if isinstance(e.get("observations"), dict) else {}
        m = obs.get("measurements", {}) if isinstance(obs.get("measurements"), dict) else (e.get("measurements", {}) or {})
        
        bp_val = m.get("blood_pressure")
        sys_val, dia_val = parse_bp(bp_val, m)

        glu_obj = m.get("blood_glucose")
        glu_val = glu_obj.get("value") if isinstance(glu_obj, dict) else (m.get("blood_sugar_mg_dl") or m.get("random_blood_sugar_mg_dl") or m.get("glucose_mg_dl") or m.get("glucose"))
        wt_val = m.get("weight_kg") or m.get("weight")
        pulse_val = m.get("pulse_bpm") or m.get("pulse") or m.get("heart_rate")
        muac_val = m.get("muac_cm") or m.get("muac")

        v_meta = e.get("visit", {}) if isinstance(e.get("visit"), dict) else {}
        v_date = v_meta.get("date") or e.get("date") or e.get("created_at", "")[:10] or datetime.utcnow().isoformat()[:10]
        v_no = v_meta.get("visiting_no") or e.get("visiting_no") or (idx + 1)

        p_key = f"{v_date}_{v_no}"
        all_points_map[p_key] = {
            "date": v_date,
            "visiting_no": v_no,
            "visit_number": v_no,
            "systolic": float(sys_val) if sys_val is not None else None,
            "diastolic": float(dia_val) if dia_val is not None else None,
            "glucose": float(glu_val) if glu_val is not None else None,
            "pulse": float(pulse_val) if pulse_val is not None else None,
            "weight": float(wt_val) if wt_val is not None else None,
            "muac": float(muac_val) if muac_val is not None else None
        }

    # Also incorporate any standalone history points from vitals_baselines
    if existing_base_doc and isinstance(existing_base_doc.get("recent_history_points"), list):
        for pt in existing_base_doc["recent_history_points"]:
            p_date = pt.get("date") or datetime.utcnow().isoformat()[:10]
            p_no = pt.get("visiting_no") or pt.get("visit_number") or len(all_points_map) + 1
            p_key = f"{p_date}_{p_no}"
            if p_key not in all_points_map:
                all_points_map[p_key] = {
                    "date": p_date,
                    "visiting_no": p_no,
                    "visit_number": p_no,
                    "systolic": float(pt["systolic"]) if pt.get("systolic") is not None else None,
                    "diastolic": float(pt["diastolic"]) if pt.get("diastolic") is not None else None,
                    "glucose": float(pt["glucose"]) if pt.get("glucose") is not None else None,
                    "pulse": float(pt["pulse"]) if pt.get("pulse") is not None else None,
                    "weight": float(pt["weight"]) if pt.get("weight") is not None else None,
                    "muac": float(pt["muac"]) if pt.get("muac") is not None else None
                }

    sorted_history_points = sorted(all_points_map.values(), key=lambda x: (x["date"], x.get("visiting_no") or 0))

    # 4. Partition History (Average of previous readings) vs Today's Reading (Latest measurements)
    now_iso = datetime.utcnow().isoformat() + "Z"
    today_date = now_iso[:10]

    latest_meas = None
    previous_points = []

    if sorted_history_points:
        latest_meas = sorted_history_points[-1]
        if len(sorted_history_points) > 1:
            previous_points = sorted_history_points[:-1]
        else:
            previous_points = sorted_history_points

    # Compute averages of previous readings
    sys_prev = [p["systolic"] for p in previous_points if p.get("systolic") is not None]
    dia_prev = [p["diastolic"] for p in previous_points if p.get("diastolic") is not None]
    glu_prev = [p["glucose"] for p in previous_points if p.get("glucose") is not None]
    pulse_prev = [p["pulse"] for p in previous_points if p.get("pulse") is not None]
    wt_prev = [p["weight"] for p in previous_points if p.get("weight") is not None]
    muac_prev = [p["muac"] for p in previous_points if p.get("muac") is not None]

    base_metrics = {
        "systolic_bp": round(sum(sys_prev) / len(sys_prev), 1) if sys_prev else None,
        "diastolic_bp": round(sum(dia_prev) / len(dia_prev), 1) if dia_prev else None,
        "random_blood_sugar_mg_dl": round(sum(glu_prev) / len(glu_prev), 1) if glu_prev else None,
        "pulse_bpm": round(sum(pulse_prev) / len(pulse_prev), 1) if pulse_prev else None,
        "weight_kg": round(sum(wt_prev) / len(wt_prev), 1) if wt_prev else None,
        "muac_cm": round(sum(muac_prev) / len(muac_prev), 1) if muac_prev else None
    }

    # Compute delta between latest measurement and previous average baseline
    delta_analysis = None
    if latest_meas:
        b_sys = base_metrics["systolic_bp"]
        b_dia = base_metrics["diastolic_bp"]
        b_glu = base_metrics["random_blood_sugar_mg_dl"]
        b_pulse = base_metrics["pulse_bpm"]
        b_wt = base_metrics["weight_kg"]

        c_sys = latest_meas.get("systolic")
        c_dia = latest_meas.get("diastolic")
        c_glu = latest_meas.get("glucose")
        c_pulse = latest_meas.get("pulse")
        c_wt = latest_meas.get("weight")

        s_delta = round(c_sys - b_sys, 1) if (c_sys is not None and b_sys is not None) else 0.0
        d_delta = round(c_dia - b_dia, 1) if (c_dia is not None and b_dia is not None) else 0.0
        g_delta = round(c_glu - b_glu, 1) if (c_glu is not None and b_glu is not None) else None
        p_delta = round(c_pulse - b_pulse, 1) if (c_pulse is not None and b_pulse is not None) else None
        w_delta = round(c_wt - b_wt, 2) if (c_wt is not None and b_wt is not None) else None

        is_spurt = s_delta >= 20.0 or d_delta >= 15.0
        is_crisis = (c_sys is not None and c_sys >= 180.0) or (c_dia is not None and c_dia >= 110.0)

        is_ped = (p_age is not None and p_age <= 5)
        ped_stat = "not_applicable"
        if is_ped and w_delta is not None:
            ped_stat = "weight_loss" if w_delta < 0 else ("faltering" if w_delta == 0 else "normal")

        sev = "acute_crisis" if is_crisis else ("moderate_drift" if is_spurt or (g_delta and g_delta >= 50) or ped_stat == "weight_loss" else "normal")
        head = "Critical Hypertensive Crisis" if is_crisis else ("Acute Hypertensive Spurt" if is_spurt else "Stable Longitudinal Trend")
        act = "Immediate referral required." if is_crisis else ("Verify medication adherence & re-check BP in 48h." if is_spurt else "Vitals conform to household longitudinal baseline.")

        delta_analysis = {
            "systolic_delta": s_delta,
            "diastolic_delta": d_delta,
            "glucose_delta": g_delta,
            "pulse_delta": p_delta,
            "weight_delta_kg": w_delta,
            "is_hypertensive_spurt": is_spurt,
            "is_acute_crisis": is_crisis,
            "pediatric_velocity_status": ped_stat,
            "severity": sev,
            "alert_headline": head,
            "clinical_action": act
        }

    last_update_date = sorted_history_points[-1]["date"] if sorted_history_points else today_date
    last_v_no = sorted_history_points[-1].get("visiting_no") if sorted_history_points else 0

    baseline_doc = {
        "person_id": person_id,
        "household_id": p_hh_id,
        "person_name": p_name,
        "age": p_age,
        "gender": p_gender,
        "visiting_no": last_v_no,
        "baseline_metrics": base_metrics,
        "rolling_statistics": {
            "sample_count": len(previous_points),
            "systolic_std_dev": 0.0,
            "systolic_min": min(sys_prev) if sys_prev else None,
            "systolic_max": max(sys_prev) if sys_prev else None,
            "weight_velocity_kg_per_month": 0.0
        },
        "latest_measurement": latest_meas,
        "latest_delta_analysis": delta_analysis,
        "recent_history_points": sorted_history_points,
        "created_at": existing_base_doc.get("created_at") if existing_base_doc else now_iso,
        "updated_at": now_iso
    }

    # Upsert into vitals_baselines_col
    if vitals_baselines_col is not None and sorted_history_points:
        try:
            vitals_baselines_col.update_one(
                {"person_id": person_id},
                {"$set": baseline_doc},
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB Error updating baseline doc] {e}")

    return baseline_doc

@router.post("/analyze-delta", response_model=VitalsBaselineSchema)
def analyze_vitals_delta(req: VitalsDeltaRequestSchema):
    """
    Computes real-time delta deviation against the MongoDB baseline.
    If acute deviation or growth faltering is detected:
    1. Updates the baseline document in MongoDB.
    2. Automatically generates an active CareGap in the household's MongoDB Care Ledger.
    3. Escalates household priority in MongoDB.
    """
    baseline_doc = get_vitals_baseline(req.person_id)
    baseline_metrics = baseline_doc.get("baseline_metrics", {})

    # Calculate Deltas
    base_sys = baseline_metrics.get("systolic_bp") or 120.0
    base_dia = baseline_metrics.get("diastolic_bp") or 80.0
    base_glu = baseline_metrics.get("random_blood_sugar_mg_dl")
    base_pulse = baseline_metrics.get("pulse_bpm")
    base_wt = baseline_metrics.get("weight_kg")
    base_muac = baseline_metrics.get("muac_cm")

    sys_delta = round(req.systolic_bp - base_sys, 1) if req.systolic_bp is not None else 0.0
    dia_delta = round(req.diastolic_bp - base_dia, 1) if req.diastolic_bp is not None else 0.0
    glu_delta = round(req.glucose_mg_dl - base_glu, 1) if (req.glucose_mg_dl is not None and base_glu is not None) else None
    pulse_delta = round(req.pulse_bpm - base_pulse, 1) if (req.pulse_bpm is not None and base_pulse is not None) else None
    wt_delta = round(req.weight_kg - base_wt, 2) if (req.weight_kg is not None and base_wt is not None) else None

    # Acute Spurt & Crisis Rules
    is_hypertensive_spurt = sys_delta >= 20.0 or dia_delta >= 15.0
    is_acute_crisis = (
        (req.systolic_bp is not None and req.systolic_bp >= 180.0) or
        (req.diastolic_bp is not None and req.diastolic_bp >= 110.0) or
        (sys_delta >= 35.0 and req.systolic_bp is not None and req.systolic_bp >= 160.0)
    )

    # Pediatric Velocity Rules (Ages 0 - 5)
    is_pediatric = (baseline_doc.get("age") is not None and baseline_doc.get("age") <= 5)
    pediatric_status = "not_applicable"
    if is_pediatric and wt_delta is not None:
        if wt_delta < 0:
            pediatric_status = "weight_loss"
        elif wt_delta == 0:
            pediatric_status = "faltering"
        else:
            pediatric_status = "normal"

    # Severity & Action Synthesis
    severity = "normal"
    headline = "Stable Longitudinal Trend"
    action_text = "Vitals conform to household longitudinal baseline."

    if is_acute_crisis:
        severity = "acute_crisis"
        headline = "Critical Hypertensive Crisis Detected"
        action_text = "Systolic BP >= 180 or Diastolic >= 110. Immediate Medical Officer referral required. Re-check BP in 15 mins."
    elif is_hypertensive_spurt:
        severity = "moderate_drift"
        headline = "Acute Hypertensive Spurt Detected"
        action_text = f"Systolic spurt +{sys_delta} mmHg exceeds 20 mmHg threshold. Verify antihypertensive adherence and re-check BP in 48h."
    elif glu_delta and glu_delta >= 50.0:
        severity = "moderate_drift"
        headline = "Acute Glycemic Drift Detected"
        action_text = f"Blood sugar surged +{glu_delta} mg/dL over baseline. Verify diet and diabetes medication compliance."
    elif pediatric_status == "weight_loss":
        severity = "moderate_drift"
        headline = "Pediatric Growth Faltering (Weight Drop)"
        action_text = f"Child experienced weight loss of {wt_delta} kg. Counsel on dietary diversity (milk/eggs) and verify illness history."

    delta_analysis = {
        "systolic_delta": sys_delta,
        "diastolic_delta": dia_delta,
        "glucose_delta": glu_delta,
        "pulse_delta": pulse_delta,
        "weight_delta_kg": wt_delta,
        "is_hypertensive_spurt": is_hypertensive_spurt,
        "is_acute_crisis": is_acute_crisis,
        "pediatric_velocity_status": pediatric_status,
        "severity": severity,
        "alert_headline": headline,
        "clinical_action": action_text
    }

    # Determine visiting_no (count of previous measurements/encounters for this person + 1)
    visiting_no = req.visiting_no
    if not visiting_no:
        if encounters_col is not None:
            try:
                prev_enc_count = encounters_col.count_documents({"person.person_id": req.person_id})
                hist_len = len(baseline_doc.get("recent_history_points", []))
                visiting_no = max(prev_enc_count, hist_len) + 1
            except Exception as e:
                print(f"[MongoDB visiting_no count error in vitals] {e}")
                visiting_no = len(baseline_doc.get("recent_history_points", [])) + 1
        else:
            visiting_no = len(baseline_doc.get("recent_history_points", [])) + 1

    # Update latest measurement
    now_iso = datetime.utcnow().isoformat() + "Z"
    date_today = now_iso[:10]
    new_point = {
        "date": date_today,
        "visiting_no": visiting_no,
        "visit_number": visiting_no,
        "systolic": req.systolic_bp,
        "diastolic": req.diastolic_bp,
        "glucose": req.glucose_mg_dl,
        "pulse": req.pulse_bpm,
        "weight": req.weight_kg,
        "muac": req.muac_cm
    }

    history_points = baseline_doc.get("recent_history_points", [])
    history_points.append(new_point)
    if len(history_points) > 10:
        history_points = history_points[-10:]

    baseline_doc["visiting_no"] = visiting_no
    baseline_doc["latest_measurement"] = new_point
    baseline_doc["latest_delta_analysis"] = delta_analysis
    baseline_doc["recent_history_points"] = history_points
    baseline_doc["updated_at"] = now_iso
    if not baseline_doc.get("household_id"):
        baseline_doc["household_id"] = req.household_id

    # Persist in MongoDB Atlas
    if vitals_baselines_col is not None:
        try:
            vitals_baselines_col.update_one(
                {"person_id": req.person_id},
                {"$set": baseline_doc},
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB Error updating baseline] {e}")

    # AUTO-GENERATE CARE GAP IF DEVIATION DETECTED
    if severity in ["acute_crisis", "moderate_drift"] and care_ledgers_col is not None:
        try:
            gap_id = f"gap-vitals-{uuid.uuid4().hex[:8]}"
            gap_type = "vitals_delta_hypertensive_spurt" if is_hypertensive_spurt else ("child_growth_velocity_faltering" if pediatric_status == "weight_loss" else "acute_glycemic_drift")
            programme = "malnutrition" if pediatric_status == "weight_loss" else "ncd"

            new_gap = {
                "id": gap_id,
                "household_id": req.household_id,
                "person_id": req.person_id,
                "person_name": baseline_doc.get("person_name", "Beneficiary"),
                "programme": programme,
                "gap_type": gap_type,
                "description": f"{headline}: {action_text}",
                "evidence": [
                    {
                        "source_type": "vitals_delta_detector",
                        "visiting_no": visiting_no,
                        "observed_at": now_iso,
                        "systolic_delta": sys_delta,
                        "diastolic_delta": dia_delta,
                        "glucose_delta": glu_delta,
                        "weight_delta_kg": wt_delta
                    }
                ],
                "severity": "critical" if is_acute_crisis else "high",
                "status": "open",
                "due_date": (datetime.utcnow().date()).isoformat(),
                "owner": "ASHA Worker (Ward 4)",
                "recommended_action": action_text,
                "last_reviewed_at": now_iso
            }

            care_ledgers_col.update_one(
                {"household_id": req.household_id},
                {
                    "$push": {"care_gaps": new_gap},
                    "$set": {"updated_at": now_iso, "visiting_no": visiting_no, "priority_score": 95.0 if is_acute_crisis else 92.5},
                    "$inc": {"open_gaps_count": 1}
                },
                upsert=True
            )

            # Update Household priority
            if households_col is not None:
                households_col.update_one(
                    {"id": req.household_id},
                    {
                        "$set": {
                            "priority_score": 95.0 if is_acute_crisis else 92.5,
                            "updated_at": now_iso
                        },
                        "$addToSet": {"priority_reasons": f"{headline} (+{sys_delta} mmHg)"}
                    }
                )
        except Exception as e:
            print(f"[MongoDB Error auto-generating care gap] {e}")

    return baseline_doc
