from fastapi import APIRouter
from models.schemas import SyncPushRequestSchema, SyncPushResponseSchema

router = APIRouter(prefix="/api/v1/sync", tags=["Sync"])

@router.post("/push", response_model=SyncPushResponseSchema)
def push_offline_sync(request: SyncPushRequestSchema):
    """
    Idempotent batch synchronisation endpoint for offline client queues.
    Accepts client-generated event items (visits, corrections, gap updates).
    """
    accepted_ids = []
    failed_items = []

    for item in request.items:
        try:
            # Process item payload (e.g. visit, care_gap)
            accepted_ids.append(item.client_event_id)
        except Exception as e:
            failed_items.append({"client_event_id": item.client_event_id, "reason": str(e)})

    return SyncPushResponseSchema(accepted=accepted_ids, failed=failed_items)
