from typing import List, Optional, Tuple
from dataclasses import dataclass

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException


@dataclass
class InvitationResult:
    email: str
    success: bool
    message: str
    resource_name: Optional[str] = None


def _sanitize_customer_id(customer_id: Optional[str]) -> Optional[str]:
    if customer_id is None:
        return None
    return customer_id.replace("-", "").strip()


def build_client(
    developer_token: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
    login_customer_id: Optional[str] = None,
) -> GoogleAdsClient:
    config = {
        "developer_token": developer_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "use_proto_plus": True,
    }
    if login_customer_id:
        config["login_customer_id"] = _sanitize_customer_id(login_customer_id)
    return GoogleAdsClient.load_from_dict(config)


def parse_access_role(client: GoogleAdsClient, role_str: str):
    role_enum = client.enums.AccessRoleEnum
    mapping = {
        "admin": role_enum.ADMIN,
        "standard": role_enum.STANDARD,
        "read_only": role_enum.READ_ONLY,
        "readonly": role_enum.READ_ONLY,
        "email_only": role_enum.EMAIL_ONLY,
        "emailonly": role_enum.EMAIL_ONLY,
    }
    key = role_str.strip().lower()
    if key not in mapping:
        raise ValueError("Unknown role. Use: admin | standard | read_only | email_only")
    return mapping[key]


def invite_emails(
    client: GoogleAdsClient,
    target_customer_id: str,
    emails: List[str],
    access_role_str: str = "read_only",
) -> Tuple[List[InvitationResult], List[InvitationResult]]:
    service = client.get_service("CustomerUserAccessInvitationService")
    target_cid = _sanitize_customer_id(target_customer_id)
    access_role = parse_access_role(client, access_role_str)

    successes: List[InvitationResult] = []
    failures: List[InvitationResult] = []

    for email in sorted(set([e.strip().lower() for e in emails if e.strip()])):
        op = client.get_type("CustomerUserAccessInvitationOperation")
        inv = op.create
        inv.email_address = email
        inv.access_role = access_role
        try:
            resp = service.mutate_customer_user_access_invitation(
                customer_id=target_cid, operation=op
            )
            successes.append(
                InvitationResult(
                    email=email,
                    success=True,
                    message="Invited",
                    resource_name=resp.result.resource_name,
                )
            )
        except GoogleAdsException as ex:
            msg_parts = [err.message for err in ex.failure.errors]
            failures.append(
                InvitationResult(
                    email=email,
                    success=False,
                    message=" | ".join(msg_parts) or str(ex),
                    resource_name=None,
                )
            )
        except Exception as ex:  # pragma: no cover - unexpected
            failures.append(
                InvitationResult(
                    email=email,
                    success=False,
                    message=str(ex),
                    resource_name=None,
                )
            )

    return successes, failures