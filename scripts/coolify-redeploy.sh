#!/usr/bin/env bash
# coolify-redeploy.sh — trigger a Coolify redeploy for a named service and poll until done.
#
# Runs from your Mac. Connects to root@104.131.41.153 via SSH, reads the API token from
# /root/.coolify-token on the server, and calls the Coolify API at localhost:8000 from
# inside the server.
#
# Server-side prereq: /root/.coolify-token must contain a valid Coolify API token (format: <id>|<token>).
# To generate one: SSH to server and run:
#   docker exec coolify php artisan tinker --execute="
#     use Illuminate\Support\Str;
#     \$user = \App\Models\User::first();
#     \$raw = Str::random(40);
#     \DB::table('personal_access_tokens')->insert([
#       'tokenable_type'=>'App\\\\Models\\\\User','tokenable_id'=>\$user->id,
#       'name'=>'redeploy-script','token'=>hash('sha256',\$raw),
#       'abilities'=>'[\"*\"]','team_id'=>0,'created_at'=>now(),'updated_at'=>now()
#     ]);
#     \$id = \DB::table('personal_access_tokens')->orderBy('id','desc')->first()->id;
#     echo \$id . '|' . \$raw . PHP_EOL;
#   "
#   # Then: echo '<output>' > /root/.coolify-token && chmod 600 /root/.coolify-token
#
# To add a new service: add a line to the UUIDS section below.
#
# Usage:
#   ./scripts/coolify-redeploy.sh <service> [-f|--force]
#   ./scripts/coolify-redeploy.sh frontend
#   ./scripts/coolify-redeploy.sh backend --force

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SSH_KEY="${HOME}/.ssh/id_rsa_apolox_do"
SSH_HOST="root@104.131.41.153"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o BatchMode=yes"
TOKEN_FILE="/root/.coolify-token"
COOLIFY_API="http://localhost:8000/api/v1"
POLL_INTERVAL=10   # seconds between status checks
TIMEOUT=300        # seconds before giving up (5 min)

# ---------------------------------------------------------------------------
# Service → UUID mapping  (add new services here)
# ---------------------------------------------------------------------------
declare -A UUIDS
UUIDS["frontend"]="uofmqowrhluc9vob1b6eeovq"
UUIDS["backend"]="uofmqowrhluc9vob1b6eeovq"

# Note: frontend and backend share a single Coolify application UUID because
# Coolify manages them as a single docker-compose stack. Deploying either
# service name redeploys the entire stack.

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
usage() {
  echo "Usage: $0 <service> [-f|--force]"
  echo ""
  echo "  service   One of: ${!UUIDS[*]}"
  echo "  -f/--force  Force a full image rebuild (default: pull-and-restart only)"
  echo ""
  echo "Examples:"
  echo "  $0 frontend"
  echo "  $0 backend --force"
  exit 1
}

SERVICE=""
FORCE=false

for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=true ;;
    -h|--help)  usage ;;
    -*)         echo "Unknown flag: $arg"; usage ;;
    *)          SERVICE="$arg" ;;
  esac
done

[[ -z "$SERVICE" ]] && { echo "Error: service name required."; usage; }

if [[ -z "${UUIDS[$SERVICE]+x}" ]]; then
  echo "Error: unknown service '${SERVICE}'. Known services: ${!UUIDS[*]}"
  exit 1
fi

UUID="${UUIDS[$SERVICE]}"

# ---------------------------------------------------------------------------
# Helper: run a command on the remote server
# ---------------------------------------------------------------------------
remote() {
  ssh ${SSH_OPTS} "${SSH_HOST}" "$@"
}

# ---------------------------------------------------------------------------
# Read token from server
# ---------------------------------------------------------------------------
echo "[1/4] Reading API token from ${SSH_HOST}:${TOKEN_FILE} ..."
TOKEN=$(remote "cat ${TOKEN_FILE}" 2>/dev/null) || {
  echo "Error: could not read ${TOKEN_FILE} on ${SSH_HOST}."
  echo "See the header comment in this script for how to create it."
  exit 1
}
[[ -z "$TOKEN" ]] && { echo "Error: ${TOKEN_FILE} is empty."; exit 1; }

# ---------------------------------------------------------------------------
# Trigger deploy
# ---------------------------------------------------------------------------
FORCE_PARAM=""
$FORCE && FORCE_PARAM="&force=true"

echo "[2/4] Triggering redeploy for service='${SERVICE}' (uuid=${UUID}) force=${FORCE} ..."

DEPLOY_RESPONSE=$(remote "curl -sf \
  -X GET \
  -H 'Authorization: Bearer ${TOKEN}' \
  '${COOLIFY_API}/deploy?uuid=${UUID}${FORCE_PARAM}'")

DEPLOYMENT_UUID=$(echo "${DEPLOY_RESPONSE}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
deps = data.get('deployments', [])
if not deps:
    raise ValueError('No deployments in response: ' + str(data))
print(deps[0]['deployment_uuid'])
" 2>/dev/null) || {
  echo "Error: failed to parse deployment UUID from response:"
  echo "${DEPLOY_RESPONSE}"
  exit 1
}

echo "    Deployment queued: ${DEPLOYMENT_UUID}"

# ---------------------------------------------------------------------------
# Poll until terminal state
# ---------------------------------------------------------------------------
echo "[3/4] Polling deployment status (timeout=${TIMEOUT}s, interval=${POLL_INTERVAL}s) ..."

elapsed=0
last_status=""

while true; do
  STATUS_RESPONSE=$(remote "curl -sf \
    -H 'Authorization: Bearer ${TOKEN}' \
    '${COOLIFY_API}/deployments/${DEPLOYMENT_UUID}'" 2>/dev/null) || {
    echo "    Warning: failed to fetch status, retrying..."
    sleep "${POLL_INTERVAL}"
    elapsed=$((elapsed + POLL_INTERVAL))
    continue
  }

  STATUS=$(echo "${STATUS_RESPONSE}" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('status','unknown'))
" 2>/dev/null) || STATUS="unknown"

  if [[ "$STATUS" != "$last_status" ]]; then
    echo "    [${elapsed}s] status: ${STATUS}"
    last_status="$STATUS"
  fi

  case "$STATUS" in
    finished|success)
      echo "[4/4] Deployment succeeded."
      break
      ;;
    failed|error|cancelled)
      echo "Error: deployment ended with status '${STATUS}'."
      echo "Logs: ssh ${SSH_HOST} \"curl -sf -H 'Authorization: Bearer \${TOKEN}' '${COOLIFY_API}/deployments/${DEPLOYMENT_UUID}'\""
      exit 2
      ;;
  esac

  if [[ $elapsed -ge $TIMEOUT ]]; then
    echo "Error: timed out after ${TIMEOUT}s waiting for deployment ${DEPLOYMENT_UUID} (last status: ${STATUS})."
    exit 3
  fi

  sleep "${POLL_INTERVAL}"
  elapsed=$((elapsed + POLL_INTERVAL))
done

echo ""
echo "Done. Service '${SERVICE}' redeployed successfully."
echo "Deployment UUID: ${DEPLOYMENT_UUID}"
