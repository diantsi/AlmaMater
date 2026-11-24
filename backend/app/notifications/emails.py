from datetime import datetime

from app.config import settings
from app.events.models import Event
from app.events.service import KYIV
from app.notifications.models import DeliveryKind

FOOTER_CHANGED = (
    "Ви отримали цей лист, бо підписалися на оновлення цієї події в AlmaMater. "
    "Відписатися можна на сторінці події."
)
FOOTER_CANCELLED = (
    "Ви отримали цей лист, бо були підписані на оновлення цієї події в AlmaMater. "
    "Підписку завершено — інших листів про цю подію не буде."
)


def _kyiv(moment: datetime) -> str:
    return moment.astimezone(KYIV).strftime("%d.%m.%Y, %H:%M")


# api-contracts.md §6.8 / A-18: fixed Ukrainian template with the event's current title, date and time, link
def render(kind: str, event: Event) -> tuple[str, str]:
    url = settings.app_public_url.rstrip("/") + event.event_url
    when = _kyiv(event.starts_at)
    if kind == DeliveryKind.CANCELLED:
        subject = f"Подію «{event.title}» скасовано"
        body = (
            f"Вітаємо!\n\n"
            f"Організатори скасували подію «{event.title}», заплановану на {when} (за київським часом).\n\n"
            f"Сторінка події:\n{url}\n\n"
            f"{FOOTER_CANCELLED}\n"
        )
    else:
        subject = f"Зміни в події «{event.title}»"
        body = (
            f"Вітаємо!\n\n"
            f"Організатори змінили подію «{event.title}», на яку ви підписані.\n\n"
            f"Дата і час: {when} (за київським часом)\n\n"
            f"Усі актуальні деталі — на сторінці події:\n{url}\n\n"
            f"{FOOTER_CHANGED}\n"
        )
    return subject, body
