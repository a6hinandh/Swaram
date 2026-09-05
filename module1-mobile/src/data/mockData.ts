import { HouseholdSummary, HouseholdCareLedger, VisitDraft } from '../types';

export const MOCK_HOUSEHOLDS: HouseholdSummary[] = [
  {
    id: 'h-lakshmi-001',
    external_id: 'ASHA-WARD4-HH042',
    head_of_household: 'Lakshmi Amma',
    address: 'House 42, Kudumbashree Lane, Aluva',
    members_count: 4,
    open_care_gaps: 3,
    priority_score: 88.5,
    priority_reasons: [
      'ANC 3rd trimester check overdue by 8 days',
      'Child immunisation (MR vaccine) pending confirmation',
      'Child malnutrition monitoring active (low dietary diversity)'
    ],
    malnutrition_risk: 'Moderate'
  },
  {
    id: 'h-suresh-002',
    external_id: 'ASHA-WARD4-HH043',
    head_of_household: 'Suresh Kumar',
    address: 'House 45, Temple Road, Aluva',
    members_count: 3,
    open_care_gaps: 1,
    priority_score: 52.0,
    priority_reasons: ['NCD Hypertension quarterly recheck due'],
    malnutrition_risk: 'Normal'
  }
];

export const MOCK_CARE_LEDGER: HouseholdCareLedger = {
  household_id: 'h-lakshmi-001',
  household_name: 'Lakshmi Household',
  updated_at: new Date().toISOString(),
  open_gaps_count: 3,
  priority_score: 88.5,
  priority_reasons: [
    'ANC 3rd trimester check overdue by 8 days',
    'Child immunisation (MR vaccine) pending confirmation',
    'Child malnutrition monitoring active (low dietary diversity)'
  ],
  longitudinal_narrative:
    'Lakshmi Amma (26y, 32 weeks pregnant). Blood pressure was borderline (135/88 mmHg) on last visit. Iron-folic acid tablets were supplied. Younger child Rahul (18 months) missed the MR vaccine follow-up. Child nutrition intake shows moderate risk with low dietary diversity; eggs, milk, and pulses diversity counseling required.',
  malnutrition_trend: 'Moderate vulnerability - Dietary diversity & MUAC monitoring ongoing',
  care_gaps: [
    {
      id: 'gap-anc-01',
      household_id: 'h-lakshmi-001',
      person_id: 'p-lakshmi-01',
      programme: 'maternal',
      gap_type: 'overdue_anc_checkup',
      description: '3rd Trimester antenatal examination and BP check overdue by 8 days.',
      evidence: [
        {
          source_type: 'visit_observation',
          observed_at: '2026-08-20T10:30:00Z'
        }
      ],
      severity: 'high',
      status: 'open',
      due_date: '2026-08-28',
      owner: 'ASHA Worker (Ward 4)',
      recommended_action: 'Measure vitals, check for pedal edema, schedule PHC review',
      required_questions: [
        {
          question_id: 'q-anc-bp',
          question_text_ml: 'രക്തസമ്മർദ്ദം അളന്നോ? എത്രയാണ് റീഡിംഗ്?',
          question_text_en: 'Did you measure blood pressure? What was the reading?',
          field_target: 'vitals.systolic_bp'
        }
      ],
      last_reviewed_at: new Date().toISOString()
    },
    {
      id: 'gap-imm-02',
      household_id: 'h-lakshmi-001',
      person_id: 'p-rahul-02',
      programme: 'child_immunisation',
      gap_type: 'mr_vaccine_unconfirmed',
      description: 'Measles-Rubella vaccine status at 16-24 months unverified in MCP card.',
      evidence: [
        {
          source_type: 'paper_register_scan',
          observed_at: '2026-08-15T09:00:00Z'
        }
      ],
      severity: 'medium',
      status: 'needs_information',
      due_date: '2026-09-10',
      owner: 'ASHA Worker (Ward 4)',
      recommended_action: 'Inspect MCP card or confirm date from mother',
      required_questions: [
        {
          question_id: 'q-imm-card',
          question_text_ml: 'കുട്ടിയുടെ ഇമ്മ്യൂണൈസേഷൻ കാർഡ് പരിശോധിച്ചോ?',
          question_text_en: 'Did you check the child immunization card?'
        }
      ],
      last_reviewed_at: new Date().toISOString()
    },
    {
      id: 'gap-nut-03',
      household_id: 'h-lakshmi-001',
      person_id: 'p-rahul-02',
      programme: 'malnutrition',
      gap_type: 'child_malnutrition_risk',
      description: 'Dietary diversity score low (3/8). Child requires egg and milk protein supplementation.',
      evidence: [
        {
          source_type: 'visit_observation',
          observed_at: '2026-09-01T11:00:00Z'
        }
      ],
      severity: 'medium',
      status: 'open',
      due_date: '2026-09-15',
      owner: 'ASHA Worker (Ward 4)',
      recommended_action: 'Counsel mother on egg/milk intake and verify MUAC',
      required_questions: [
        {
          question_id: 'q_nut_dietary',
          question_text_ml: 'കുട്ടി ദിവസവും പാലും മുട്ടയും മറ്റ് പോഷകാഹാരങ്ങളും കഴിക്കാറുണ്ടോ?',
          question_text_en: 'Does the child consume milk, eggs, and nutrient-dense foods daily?'
        }
      ],
      last_reviewed_at: new Date().toISOString()
    }
  ]
};

export const MOCK_VISIT_DRAFT_RESPONSE: VisitDraft = {
  visit_id: 'v-demo-999',
  household_id: 'h-lakshmi-001',
  worker_id: 'w-asha-001',
  timestamp: new Date().toISOString(),
  language: 'ml',
  transcript:
    'ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85 ഉണ്ട്. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു. അടുത്ത ചെക്കപ്പ് അടുത്ത വ്യാഴാഴ്ച.',
  confidence: 0.94,
  validation_flags: [],
  confirmation_status: 'pending',
  person_updates: [
    {
      person_id: 'p-lakshmi-01',
      name: 'Lakshmi Amma',
      pregnancy_weeks: 32,
      vitals: {
        systolic_bp: 130,
        diastolic_bp: 85,
        weight_kg: 58.0
      },
      symptoms: ['Mild fatigue'],
      medications_given: ['Iron-Folic Acid Tablets (30 days)'],
      services_provided: ['Vitals check', 'Malnutrition screening', 'Nutritional guidance'],
      follow_up_date: '2026-09-12'
    }
  ],
  survey_fields: [
    {
      field_key: 'beneficiary_name',
      section: 'demographics',
      question_ml: 'ഗുണഭോക്താവിന്റെ പേര്',
      question_en: 'Beneficiary Name',
      value: 'Lakshmi Amma',
      status: 'extracted'
    },
    {
      field_key: 'systolic_bp',
      section: 'ncd_lifestyle',
      question_ml: 'രക്തസമ്മർദ്ദം (BP)',
      question_en: 'Blood Pressure (mmHg)',
      value: '130/85 mmHg',
      status: 'extracted'
    },
    {
      field_key: 'weight_kg',
      section: 'ncd_lifestyle',
      question_ml: 'ശരീരഭാരം',
      question_en: 'Weight (kg)',
      value: '58.0 kg',
      status: 'extracted'
    },
    {
      field_key: 'dietary_diversity',
      section: 'malnutrition',
      question_ml: 'കുട്ടിയുടെ പോഷകാഹാര ലഭ്യത (പാലും മുട്ടയും)',
      question_en: 'Child Dietary Diversity (Milk, Eggs, Pulses)',
      value: 'അപൂർണ്ണം (Missing Information)',
      status: 'missing'
    },
    {
      field_key: 'ifa_tablets',
      section: 'maternal_child',
      question_ml: 'അയൺ-ഫോളിക് ആസിഡ് ഗുളികകൾ',
      question_en: 'IFA Tablets Provided',
      value: 'Iron-Folic Acid Tablets (30 days)',
      status: 'extracted'
    }
  ],
  missing_field_prompts: [
    {
      question_id: 'q_nut_dietary',
      field_target: 'malnutrition.dietary_diversity',
      question_text_ml: 'കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും അല്ലെങ്കിൽ പയറുവർഗ്ഗങ്ങളും നൽകാറുണ്ടോ?',
      question_text_en: 'Does the child consume milk, eggs, or pulses daily?',
      is_mandatory: true
    }
  ],
  malnutrition_assessment: {
    child_age_months: 18,
    muac_cm: 12.8,
    dietary_diversity_score: 3,
    risk_level: 'moderate',
    clinical_notes: 'Dietary diversity intake is moderate; counseling advised.'
  }
};
