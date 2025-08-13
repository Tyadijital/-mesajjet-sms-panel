import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, flash, Response
from werkzeug.middleware.proxy_fix import ProxyFix
from typing import List

from .config import settings
from .google_ads_inviter import build_client, invite_emails

# Load environment variables from .env if present
load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
    app.secret_key = settings.panel.secret_key

    def requires_auth() -> bool:
        return bool(settings.panel.basic_auth_username and settings.panel.basic_auth_password)

    def check_auth(auth_header: str) -> bool:
        try:
            import base64

            scheme, b64 = auth_header.split(" ", 1)
            if scheme.lower() != "basic":
                return False
            username, password = base64.b64decode(b64).decode("utf-8").split(":", 1)
            return (
                username == settings.panel.basic_auth_username
                and password == settings.panel.basic_auth_password
            )
        except Exception:
            return False

    @app.before_request
    def _basic_auth_guard():
        if not requires_auth():
            return None
        auth = request.headers.get("Authorization")
        if auth and check_auth(auth):
            return None
        return Response(
            "Authentication required",
            401,
            {"WWW-Authenticate": 'Basic realm="Panel"'},
        )

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            default_customer_id=settings.google_ads.default_customer_id or "",
            login_customer_id=settings.google_ads.login_customer_id or "",
        )

    @app.post("/invite")
    def invite():
        customer_id = request.form.get("customer_id", "").strip()
        access_role = request.form.get("access_role", "read_only").strip()
        emails_raw = request.form.get("emails", "").strip()
        emails: List[str] = [e.strip() for e in emails_raw.replace(";", ",").split(",") if e.strip()]

        if not customer_id or not emails:
            flash("Müşteri ID ve e-posta listesi gerekli.", "danger")
            return redirect(url_for("index"))

        # Validate credentials early
        creds_missing = []
        if not settings.google_ads.developer_token:
            creds_missing.append("GOOGLE_ADS_DEVELOPER_TOKEN")
        if not settings.google_ads.oauth_client_id:
            creds_missing.append("GOOGLE_ADS_OAUTH_CLIENT_ID")
        if not settings.google_ads.oauth_client_secret:
            creds_missing.append("GOOGLE_ADS_OAUTH_CLIENT_SECRET")
        if not settings.google_ads.refresh_token:
            creds_missing.append("GOOGLE_ADS_REFRESH_TOKEN")
        if creds_missing:
            flash(
                "Eksik kimlik bilgileri: " + ", ".join(creds_missing) + ". Lütfen .env dosyasını güncelleyin.",
                "danger",
            )
            return redirect(url_for("index"))

        try:
            client = build_client(
                developer_token=settings.google_ads.developer_token,
                client_id=settings.google_ads.oauth_client_id,
                client_secret=settings.google_ads.oauth_client_secret,
                refresh_token=settings.google_ads.refresh_token,
                login_customer_id=settings.google_ads.login_customer_id,
            )
            successes, failures = invite_emails(
                client=client,
                target_customer_id=customer_id,
                emails=emails,
                access_role_str=access_role,
            )
            return render_template(
                "result.html",
                customer_id=customer_id,
                successes=successes,
                failures=failures,
                access_role=access_role,
            )
        except Exception as ex:
            flash(f"Hata: {ex}", "danger")
            return redirect(url_for("index"))

    return app


app = create_app()