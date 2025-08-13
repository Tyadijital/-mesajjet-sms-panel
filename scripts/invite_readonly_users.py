#!/usr/bin/env python3
import argparse
import os
import sys
from typing import List, Optional

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from app.google_ads_inviter import _sanitize_customer_id as sanitize_customer_id


def load_config_from_args_and_env(args: argparse.Namespace) -> dict:
    developer_token = args.developer_token or os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN")
    oauth_client_id = args.oauth_client_id or os.getenv("GOOGLE_ADS_OAUTH_CLIENT_ID")
    oauth_client_secret = args.oauth_client_secret or os.getenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET")
    refresh_token = args.refresh_token or os.getenv("GOOGLE_ADS_REFRESH_TOKEN")
    login_customer_id = sanitize_customer_id(
        args.login_customer_id or os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    )

    missing = []
    if not developer_token:
        missing.append("developer token (GOOGLE_ADS_DEVELOPER_TOKEN)")
    if not oauth_client_id:
        missing.append("oauth client id (GOOGLE_ADS_OAUTH_CLIENT_ID)")
    if not oauth_client_secret:
        missing.append("oauth client secret (GOOGLE_ADS_OAUTH_CLIENT_SECRET)")
    if not refresh_token:
        missing.append("refresh token (GOOGLE_ADS_REFRESH_TOKEN)")

    if missing:
        raise RuntimeError(
            "Missing credentials: " + ", ".join(missing) + ". Provide via CLI flags or environment vars."
        )

    config: dict = {
        "developer_token": developer_token,
        "client_id": oauth_client_id,
        "client_secret": oauth_client_secret,
        "refresh_token": refresh_token,
        "use_proto_plus": True,
    }

    if login_customer_id:
        config["login_customer_id"] = login_customer_id

    return config


def read_emails(args: argparse.Namespace) -> List[str]:
    emails: List[str] = []
    if args.emails:
        emails.extend(args.emails)
    if args.emails_file:
        with open(args.emails_file, "r", encoding="utf-8") as f:
            for line in f:
                email = line.strip()
                if email and not email.startswith("#"):
                    emails.append(email)
    emails = [e.strip().lower() for e in emails if e.strip()]
    deduped = sorted(set(emails))
    if not deduped:
        raise RuntimeError("No emails provided. Use --emails or --emails-file.")
    return deduped


def role_from_string(client: GoogleAdsClient, role_str: str):
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
        raise RuntimeError(
            "Unknown access role. Use one of: admin | standard | read_only | email_only"
        )
    return mapping[key]


def invite_single_email(
    client: GoogleAdsClient, customer_id: str, email: str, access_role
) -> str:
    service = client.get_service("CustomerUserAccessInvitationService")
    operation = client.get_type("CustomerUserAccessInvitationOperation")
    invitation = operation.create
    invitation.email_address = email
    invitation.access_role = access_role

    response = service.mutate_customer_user_access_invitation(
        customer_id=customer_id, operation=operation
    )
    return response.result.resource_name


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Invite users to a Google Ads customer with READ_ONLY access (default).\n"
            "Credentials are taken from CLI flags or environment variables."
        )
    )
    parser.add_argument(
        "--customer-id",
        required=True,
        help="Target customer ID (e.g., 123-456-7890)",
    )
    parser.add_argument(
        "--emails",
        nargs="+",
        help="One or more email addresses to invite.",
    )
    parser.add_argument(
        "--emails-file",
        help="Path to a file containing one email per line.",
    )
    parser.add_argument(
        "--access-role",
        default="read_only",
        help="Access role to grant: admin | standard | read_only | email_only (default: read_only)",
    )

    # Credentials
    parser.add_argument(
        "--developer-token",
        help="Google Ads developer token (or env GOOGLE_ADS_DEVELOPER_TOKEN)",
    )
    parser.add_argument(
        "--oauth-client-id",
        help="OAuth2 client ID (or env GOOGLE_ADS_OAUTH_CLIENT_ID)",
    )
    parser.add_argument(
        "--oauth-client-secret",
        help="OAuth2 client secret (or env GOOGLE_ADS_OAUTH_CLIENT_SECRET)",
    )
    parser.add_argument(
        "--refresh-token",
        help="OAuth2 refresh token (or env GOOGLE_ADS_REFRESH_TOKEN)",
    )
    parser.add_argument(
        "--login-customer-id",
        help="Manager account ID if acting via MCC (or env GOOGLE_ADS_LOGIN_CUSTOMER_ID)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions without creating invitations",
    )

    args = parser.parse_args()

    try:
        config = load_config_from_args_and_env(args)
        customer_id = sanitize_customer_id(args.customer_id)
        if not customer_id:
            raise RuntimeError("Invalid customer ID")

        emails = read_emails(args)
        client = GoogleAdsClient.load_from_dict(config)
        access_role = role_from_string(client, args.access_role)

        successes: List[str] = []
        failures: List[str] = []

        for email in emails:
            if args.dry_run:
                print(
                    f"DRY RUN: Would invite {email} to {customer_id} with role {args.access_role}"
                )
                continue
            try:
                resource_name = invite_single_email(
                    client, customer_id, email, access_role
                )
                print(f"Invited {email} -> {resource_name}")
                successes.append(email)
            except GoogleAdsException as ex:
                error_messages = []
                for err in ex.failure.errors:
                    error_messages.append(f"{err.error_code}: {err.message}")
                print(
                    f"ERROR inviting {email}: {' | '.join(error_messages)}",
                    file=sys.stderr,
                )
                failures.append(email)

        if args.dry_run:
            print(f"DRY RUN complete. {len(emails)} invitation(s) would be created.")
        else:
            print(
                f"Done. Success: {len(successes)}; Failed: {len(failures)}"
            )
            if failures:
                sys.exit(2)

    except Exception as e:
        print(f"Fatal: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()