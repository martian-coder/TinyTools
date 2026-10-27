import pytest
from typer.testing import CliRunner

from triaged import __version__
from triaged.cli import app, mask_password
from triaged.settings import Settings

runner = CliRunner()


def test_version_command_prints_package_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert result.stdout.strip() == __version__


def test_config_command_masks_database_password(monkeypatch: pytest.MonkeyPatch) -> None:
    from triaged import settings

    settings.get_settings.cache_clear()
    monkeypatch.setenv("TRIAGED_DATABASE_URL", "postgresql://u:s3cret@db:5432/triaged")
    try:
        result = runner.invoke(app, ["config"])
    finally:
        settings.get_settings.cache_clear()
    assert result.exit_code == 0
    assert "s3cret" not in result.stdout
    assert "postgresql://u:***@db:5432/triaged" in result.stdout


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql://u:pw@h:5432/d", "postgresql://u:***@h:5432/d"),
        ("postgresql://u@h/d", "postgresql://u@h/d"),
        ("postgresql://h/d", "postgresql://h/d"),
    ],
)
def test_mask_password(url: str, expected: str) -> None:
    assert mask_password(url) == expected


def test_settings_default_to_shadow_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TRIAGED_DEFAULT_MODE", raising=False)
    assert Settings(_env_file=None).default_mode == "shadow"


def test_settings_reject_unknown_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRIAGED_DEFAULT_MODE", "yolo")
    with pytest.raises(ValueError, match="default_mode"):
        Settings(_env_file=None)
