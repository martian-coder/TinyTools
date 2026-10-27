"""Command-line entry point: ``triagent``."""

from urllib.parse import urlsplit, urlunsplit

import typer

from triagent import __version__
from triagent.settings import get_settings


def mask_password(url: str) -> str:
    """Replace the password in a connection URL with ``***``."""
    parts = urlsplit(url)
    if parts.password is None:
        return url
    netloc = parts.netloc.replace(f":{parts.password}@", ":***@", 1)
    return urlunsplit(parts._replace(netloc=netloc))


app = typer.Typer(no_args_is_help=True, help="Triagent: escalation triage.")


@app.callback()
def main() -> None:
    """Triagent command-line interface."""


@app.command()
def version() -> None:
    """Print the installed version."""
    typer.echo(__version__)


@app.command()
def config() -> None:
    """Print the effective settings (secrets masked)."""
    settings = get_settings()
    typer.echo(f"env={settings.env}")
    typer.echo(f"database_url={mask_password(settings.database_url.unicode_string())}")
    typer.echo(f"log_level={settings.log_level}")
    typer.echo(f"default_mode={settings.default_mode}")


if __name__ == "__main__":
    app()
