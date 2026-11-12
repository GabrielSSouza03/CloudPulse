#!/bin/sh
# Cluster-level roles. Runs once, on first initialization of the data directory.
#
#   cloudpulse_migrator  owns every table; runs migrations only.
#   cloudpulse_api       request-path role; NOT the owner, so row-level security applies.
#   cloudpulse_worker    pipeline role; BYPASSRLS, cross-tenant batches are scoped in repositories.
#
# Table privileges are granted by migrations, not here.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE cloudpulse_migrator LOGIN PASSWORD '${CLOUDPULSE_MIGRATOR_PASSWORD}';
  CREATE ROLE cloudpulse_api LOGIN PASSWORD '${CLOUDPULSE_API_PASSWORD}' NOBYPASSRLS;
  CREATE ROLE cloudpulse_worker LOGIN PASSWORD '${CLOUDPULSE_WORKER_PASSWORD}' BYPASSRLS;

  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  ALTER SCHEMA public OWNER TO cloudpulse_migrator;
  GRANT USAGE ON SCHEMA public TO cloudpulse_api, cloudpulse_worker;
  REVOKE CREATE ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO cloudpulse_migrator, cloudpulse_api, cloudpulse_worker;
EOSQL
