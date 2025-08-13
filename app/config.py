import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Ensure .env is loaded before reading environment
load_dotenv()


def _get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip()


@dataclass
class PanelSettings:
    secret_key: str
    basic_auth_username: Optional[str]
    basic_auth_password: Optional[str]


@dataclass
class GoogleAdsSettings:
    developer_token: Optional[str]
    oauth_client_id: Optional[str]
    oauth_client_secret: Optional[str]
    refresh_token: Optional[str]
    login_customer_id: Optional[str]
    default_customer_id: Optional[str]


class Settings:
    def __init__(self) -> None:
        # Panel
        self.panel = PanelSettings(
            secret_key=_get_env("PANEL_SECRET_KEY", "change-me-secret"),
            basic_auth_username=_get_env("PANEL_BASIC_AUTH_USERNAME"),
            basic_auth_password=_get_env("PANEL_BASIC_AUTH_PASSWORD"),
        )

        # Google Ads
        self.google_ads = GoogleAdsSettings(
            developer_token=_get_env("GOOGLE_ADS_DEVELOPER_TOKEN"),
            oauth_client_id=_get_env("GOOGLE_ADS_OAUTH_CLIENT_ID"),
            oauth_client_secret=_get_env("GOOGLE_ADS_OAUTH_CLIENT_SECRET"),
            refresh_token=_get_env("GOOGLE_ADS_REFRESH_TOKEN"),
            login_customer_id=_get_env("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
            default_customer_id=_get_env("GOOGLE_ADS_DEFAULT_CUSTOMER_ID", _get_env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
        )


settings = Settings()