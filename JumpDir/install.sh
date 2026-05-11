#!/usr/bin/env bash
# JumpDir Advanced installer — adds shell integration to .bashrc or .zshrc

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JUMPDIR_PY="$SCRIPT_DIR/jumpdir.py"
MARKER="# JumpDir Advanced"

# Detect shell
SHELL_NAME="$(basename "${SHELL:-bash}")"
case "$SHELL_NAME" in
    zsh)  RC="$HOME/.zshrc";  INIT_FLAG="--init-zsh" ;;
    bash) RC="$HOME/.bashrc"; INIT_FLAG="--init"     ;;
    *)
        echo "Unsupported shell '$SHELL_NAME'. Add integration manually:"
        python3 "$JUMPDIR_PY" --init
        exit 1
        ;;
esac

if grep -qF "$MARKER" "$RC" 2>/dev/null; then
    echo "JumpDir is already installed in $RC"
else
    {
        echo ""
        python3 "$JUMPDIR_PY" $INIT_FLAG
    } >> "$RC"
    echo "Installed JumpDir into $RC"
fi

echo ""
echo "Reload your shell:  source $RC"
echo ""
echo "Usage:"
echo "  j           — open interactive picker"
echo "  j azure     — open picker pre-filled with 'azure'"
echo ""
echo "Directories are tracked automatically as you cd around."
