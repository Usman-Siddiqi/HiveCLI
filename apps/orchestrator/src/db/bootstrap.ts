import type Database from "better-sqlite3";

export function bootstrapDatabase(sqlite: Database.Database) {
  sqlite.exec(`
    create table if not exists workspaces (
      id text primary key,
      name text not null,
      root_path text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists agents (
      id text primary key,
      workspace_id text not null,
      name text not null,
      type text not null,
      provider text not null,
      model text,
      command text,
      args_json text not null,
      cwd text,
      env_json text not null,
      enabled integer not null,
      can_judge integer not null,
      shell_access integer not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists sessions (
      id text primary key,
      workspace_id text not null,
      title text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists tasks (
      id text primary key,
      session_id text not null,
      prompt text not null,
      mode text not null,
      judge_agent_id text,
      created_at text not null
    );
    create table if not exists agent_runs (
      id text primary key,
      session_id text not null,
      task_id text not null,
      agent_id text not null,
      status text not null,
      started_at text,
      finished_at text,
      exit_code integer,
      final_text text,
      error_text text,
      metadata_json text
    );
    create table if not exists messages (
      id text primary key,
      session_id text not null,
      task_id text not null,
      agent_run_id text not null,
      agent_id text not null,
      role text not null,
      content text not null,
      is_final integer not null,
      created_at text not null
    );
    create table if not exists events (
      id text primary key,
      session_id text not null,
      task_id text not null,
      agent_run_id text not null,
      agent_id text not null,
      type text not null,
      payload text not null,
      sequence integer not null,
      timestamp text not null
    );
    create table if not exists settings (
      id text primary key,
      key text not null unique,
      value text not null,
      created_at text not null,
      updated_at text not null
    );
  `);
}
