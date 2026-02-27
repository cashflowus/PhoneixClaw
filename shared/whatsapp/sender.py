"""Send WhatsApp messages via the Meta Cloud API (WhatsApp Business Platform)."""

import logging

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"


async def send_whatsapp_message(
    phone_number_id: str,
    access_token: str,
    to_number: str,
    message_text: str,
) -> bool:
    """Send a plain-text WhatsApp message.

    Returns True on success, False on failure (never raises).
    """
    url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message_text},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info("WhatsApp message sent to %s", to_number)
                return True
            logger.warning("WhatsApp API error %s: %s", resp.status_code, resp.text[:300])
            return False
    except Exception:
        logger.exception("Failed to send WhatsApp message")
        return False


def format_trade_alert(event: dict) -> str:
    """Build a concise trade alert message from a notification event."""
    ticker = event.get("ticker", "???")
    action = event.get("action", "")
    price = event.get("price", "")
    strike = event.get("strike", "")
    option_type = event.get("option_type", "")
    expiration = event.get("expiration", "")
    account = event.get("account_name", "")
    pipeline = event.get("pipeline_name", "")

    type_label = ""
    if option_type:
        type_label = "Call" if option_type.upper() == "CALL" else "Put" if option_type.upper() == "PUT" else option_type

    parts = [f"Trade Executed: {ticker}"]
    if strike and type_label:
        parts.append(f"${strike} {type_label}")
        if expiration:
            parts.append(f"Exp {expiration}")
    detail_parts = []
    if action:
        detail_parts.append(f"Action: {action}")
    if price:
        detail_parts.append(f"Price: ${price}")
    if detail_parts:
        parts.append(" | ".join(detail_parts))
    if account:
        parts.append(f"Account: {account}")
    if pipeline:
        parts.append(f"Pipeline: {pipeline}")

    return "\n".join(parts)
