#!/usr/bin/env bash
set -euo pipefail

required=(FOXIT_MCP_COMMAND FOXIT_MCP_COMMAND_SHA256 FOXIT_MCP_CWD FOXIT_MCP_MODULE_ROOT)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required runtime boundary variable: ${name}" >&2
    exit 1
  fi
done

if [[ "${FOXIT_MCP_COMMAND}" != /* || "${FOXIT_MCP_CWD}" != /* || "${FOXIT_MCP_MODULE_ROOT}" != /* ]]; then
  echo "MCP command, working directory, and module root must be absolute paths" >&2
  exit 1
fi
if [[ ! -x "${FOXIT_MCP_COMMAND}" ]]; then
  echo "MCP command is not executable" >&2
  exit 1
fi
if [[ ! -d "${FOXIT_MCP_CWD}" || ! -d "${FOXIT_MCP_MODULE_ROOT}" ]]; then
  echo "MCP working directory or module root does not exist" >&2
  exit 1
fi

actual_sha256="$(sha256sum "${FOXIT_MCP_COMMAND}" | cut -d' ' -f1)"
if [[ ! "${FOXIT_MCP_COMMAND_SHA256}" =~ ^[a-f0-9]{64}$ ]] || [[ "${actual_sha256}" != "${FOXIT_MCP_COMMAND_SHA256}" ]]; then
  echo "MCP command digest does not match the approved SHA-256" >&2
  exit 1
fi

case "${FOXIT_MCP_CWD}/" in
  "${FOXIT_MCP_MODULE_ROOT}/"*) ;;
  *) echo "MCP working directory must be inside the approved module root" >&2; exit 1 ;;
esac

echo "Foxit MCP runtime boundary verified"
