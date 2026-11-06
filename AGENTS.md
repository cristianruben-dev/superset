# LLM Context Guide for AuraData BI (Apache Superset fork)

AuraData BI is a data visualization platform built on Apache Superset 7.0: a Flask/Python backend and a React/TypeScript frontend. See **AuraData BI: What This Fork Changes** below for what differs from upstream.

## ⚠️ CRITICAL: Work From `main`, Never From `master`

**`main` is the AuraData BI branch.** Start every branch from `main`, merge into `main`, and open pull
requests against `main`.

`master` and the numbered branches (`6.1`, `7.0`, ...) are copies of Apache Superset that came with
the fork: they have none of AuraData BI (branding, workspaces, Format pane, Spanish translations...).
A branch made from `master` looks like a plain Superset and its pull request would try to undo the
whole fork. If you find yourself on such a branch, stop and start again from `main`.

```bash
git fetch origin main
git checkout -b my-change origin/main
```

Upstream Superset fixes come into `main` by merging an upstream release branch (see README.md),
never by basing work on `master`.

## Run Pre-commit Before Pushing

Always run pre-commit against the files changed by the current branch before
pushing. This matches CI and keeps unrelated failures already present on
`master` from blocking otherwise independent work.

```bash
# Stage your changes first
git add .

# Run pre-commit on staged files
pre-commit run

# If there are auto-fixes, stage them and commit
git add .
git commit --amend  # or new commit
```

Use `pre-commit run --all-files` when auditing or repairing the repository-wide
baseline. If that check finds failures in files untouched by the current branch,
fix them in a separate branch rather than adding unrelated changes to the
current pull request.

Common pre-commit failures:
- **Formatting** - ruff-format, oxfmt will auto-fix
- **Type errors** - mypy failures need manual fixes
- **Linting** - ruff, pylint and oxlint issues need manual fixes

## AuraData BI: What This Fork Changes

This repository is **AuraData BI**, a fork of Apache Superset 7.0 shaped like Power BI. `README.md`
(Spanish) is the human overview. Read this section before touching anything below.

### Product rules
- **Spanish first.** The UI defaults to Spanish, English is the second language. Every new
  user-facing string goes through `t()`/`tn()` *and* gets a Spanish entry in
  `superset/translations/es/LC_MESSAGES/messages.po` (informal "tú", «» quotes). Rebuild with
  `npm run build-translation` in `superset-frontend/`; `messages.json`/`messages.mo` are
  generated and git-ignored.
- **One dashboard per chart** (`AURADATA_SINGLE_DASHBOARD_CHARTS`, `superset/auradata/single_dashboard.py`).
  Commands, importers and the MCP tools validate it; an ORM listener is the safety net.
  Charts are created and edited from a side panel of their dashboard (`src/auradata/chartEditor.ts`,
  `src/auradata/dashboard/ChartEditorPanel.tsx`); there is no chart list screen.
- **Reports are built from their dashboard.** The sidebar and the "New" menu only hold home,
  workspaces, dashboards and administration (database connections are "Connections" there).
  Datasets, new datasets and SQL Lab open from the "Data" menu of a dashboard in edit mode, in
  its side panel (`src/auradata/dashboard/DataMenu.tsx`, `ChartEditorPanel.tsx`); their pages are
  wrapped in `panelOnly` (`src/auradata/PanelGate.tsx`) and redirect when opened on their own. A
  dashboard shows without the sidebar, with the logo in the top bar (`isReportRoute`).
- **Workspaces** group dashboards, with members and roles (viewer, contributor, admin)
  (`AURADATA_WORKSPACE_ACCESS`). A role never makes anyone an editor: Superset counts editorship
  (`is_editor`) as data access, so contributors and admins edit through
  `security_manager.can_edit_resource` (used by `raise_for_editorship` and the edit points) and
  never become editors (`keep_subjects` in `compute_subjects`). A new edit point asks
  `can_edit_resource` (`tests/unit_tests/auradata/workspace_security_test.py`). Data access has one
  narrow grant (`superset/auradata/workspace_grants.py`): the members of a workspace, viewers included, read the
  datasets that belong to it (`raise_for_access`, `DatasourceFilter`, `ChartFilter`,
  `DashboardAccessFilter`), never other workspaces or shared datasets. A viewer stays a viewer: no editing, no
  drafts, no chart outside a published dashboard (`hides_chart`) and no new chart on the dataset (`only_reads`). RLS
  still applies;
  SQL Lab, database schemas and editing a dataset keep their normal permissions. A new data-access
  check keeps `is_editor` and adds this grant only where the dataset is the thing read
  (`tests/unit_tests/auradata/workspace_grants_test.py`). Certifying a dashboard or chart (`certified_by`,
  `certification_details`) is for its editors and the admins of its workspace, never contributors: `can_certify` and
  `certification_errors` in `workspace_access.py`, used by the update commands and the MCP certification tool
  (`tests/unit_tests/auradata/certification_test.py`).
- **AIs connect with personal API keys** (`sst_…`, «Conectar IA» at `/connect-ai/`, `src/auradata/connectAi`): every
  role manages its own keys (`ApiKey` is not admin-only), a key acts as its owner with every fork rule, and its scopes
  only narrow MCP tools (`tests/unit_tests/mcp_service/test_api_key_scope_coverage.py` makes a new tool declare a
  mapped resource, and a mutating one a write scope). With `MCP_API_KEY_ENABLED` on, the MCP refuses requests without
  a key, so dev's `MCP_DEV_USERNAME` only applies with `MCP_API_KEY_ENABLED=false`. `MCP_SERVICE_URL` is the address
  the page shows; a JWT (`MCP_JWT_SECRET`) stays as an alternative in prod.
- **The in-app AI assistant** (`superset/auradata/assistant/`, plan in `docs/plans/2026-11-05-plan-asistente-ia.md`):
  `models.py` is the catalog (live list from the Models API, plus `MODEL_TABLE`, by exact id, with what the API does not
  say); code reads a `ModelSpec` and never asks which model it is. `settings.py` overlays the admin's choices, kept under
  one `SharedKey` of the key-value store (no table), on the `AURADATA_ASSISTANT_*` config; `AURADATA_ASSISTANT_ENABLED` only
  sets the switch until the admin saves it. The admin's effort and thinking reach a model through `tuned_spec`. Administration › AI assistant
  (`/assistant/settings/`, `/api/v1/auradata_assistant/settings/`) is admin only. `ANTHROPIC_API_KEY` stays on the server:
  no response carries it. `anthropic` is imported only where the client is built, so a process without it still starts.
  The chat is `POST /api/v1/auradata/assistant/` (SSE, `api.py`), for browser sessions only, and a turn runs in a worker (see
  **A turn in a worker** below). `agent.py` is the loop, written
  out instead of using the SDK's tool runner because each response is stored with its cost before the next, and a refused
  or cut response never runs tools. `tools.py` builds `ToolBox`, the exact tools of a user in a mode and the only gate for
  a tool name; each call runs the real tool in an in-memory MCP session under `run_as`, because the config may set
  `MCP_DEV_USERNAME`, which user resolution reads before `g.user`. Read mode also carries the `superset:read` scope, so
  the tool wrapper refuses writes by itself. A conversation belongs to one user, dashboard and mode, and only grows
  (`conversations.py`, tables `auradata_assistant_conversations` and `auradata_assistant_messages`): `content` is sent
  back unchanged, except the blocks the API says to omit before a `fallback` block, and refused turns stay for their cost
  but are not sent. What a tool returns never enters the system prompt (`prompt.py`). The model call waits in a thread of
  its own (`ModelCall`, HTTP only, never the session, `g` or the tools) and yields a `TICK` every second, unwritten, which is
  where a turn hears it must stop: the SDK drops the pings and long stretches of thinking have no text. Each `ModelSpec` says its `thinking_display`
  (`updates`, or None: `summarized` arrives in English with internal details; `tuned_spec` clears it when the admin stops thinking, because
  `disabled` and `between_tools` refuse a `display`), and the text of thinking blocks streams as `note` events, among the
  steps of the answer and always as plain text. A note is not stored apart: the blocks stay as they came, and a
  conversation read later shows what they hold (`transcriptOf`). Thinking events without text never reach the queue of
  `ModelCall`: they would restart its wait with nothing sent. A turn that stops closes that call (`ModelCall`, the connection
  is shut down because closing a socket does not wake its reader) and what the API already reported stays as a row with
  `stop_reason: interrupted`, kept for its cost and never sent. A proxy needs buffering off on the chat, decide and stream
  routes (`docker/nginx`). A model without tool search is refused (422) for a history that
  used it. How long a conversation is comes from `context_tokens` of its last answer (`context_of_message`), which the too-long
  warning reads: what the model read the last time it ran. A tool search runs the model several times inside one response and
  the top level of `usage` adds them up, which is right for the cost and about double for the length, so never measure the
  context from the token columns. `usage.iterations` does not come without a beta header, so a request with tool search always
  sends the fallback one (`USAGE_PER_PASS_BETA`), without `fallbacks` on a model that has none; it leaves the prompt cache as it was.
- **A turn in a worker** (`turns.py`, `turn_store.py`, `superset/tasks/assistant_turn.py`, queue `auradata_assistant`). Chat and
  decide check everything in the request as ever, store what the person said, take the lock of the conversation (one turn per
  conversation) and queue a task that only carries `turn_id`. The ticket in Redis (`TurnTicket`) holds the user the request
  read from its session: no client writes it and the task has no argument for a user. `_owner_of` holds it against the owner,
  mode and dashboard of the conversation and fails closed for a user who is gone or inactive; the turn then runs under
  `override_user`, each tool under `run_as` with that `user_id` (`InProcessPrincipal.user_id` refuses a name that became someone
  else), and what the person may do on the report is read again. Never a system user. The language travels in the ticket: a worker has no session. It
  runs inside an empty `test_request_context(method="POST")`, because per-user OAuth2 and `SavedQueryFilter` ask for a request;
  that adds no identity, and Flask-Login gets the same user in `g._login_user`, never through a session. A turn
  runs once or never: `acks_late` off, no retries, and an atomic `claim`, which a reader giving up on a queued turn takes too.
  Each event goes to a numbered stream of the conversation (`MAX_EVENTS`, and a reader behind its start gets `trimmed`); only the holder of the lock writes, in one Lua step, and `turn_end` lets go in that step, so a worker
  given up for dead cannot write. `GET .../conversations/<id>/stream/?after=<n>` (`relay`) lasts 45 s at most, with
  `: keep-alive` through silence, and each connection reads the session, the owner and the report again; anyone else gets a 404, a
  key or guest a 403. `POST .../stop/` leaves a mark a thread of the turn reads every second, and stopping closes the generator, the path that stores what was paid; a running tool finishes. A turn has its own deadline (`AURADATA_ASSISTANT_TURN_SECONDS`), because `SoftTimeLimitExceeded` is an `Exception` that the handlers around tools would swallow; Celery's `time_limit` is the last resort. `settle_turn`
  runs wherever the owner comes back: a turn without a heartbeat, or queued past `AURADATA_ASSISTANT_QUEUE_SECONDS`, is closed
  once (answers for decided calls, the end of an open change, a `turn_lost` record that `lost_turns` gives the panel). Without `AURADATA_ASSISTANT_REDIS_URL` the chat answers 503. While a turn
  runs, `GET .../conversations/<id>/` leaves out what it stored and gives `running.after`: the panel reads the turn whole from
  that number (rows would show twice). Leaving the panel only stops reading (`leave`, `rejoin`); `remembered.ts` brings a reload
  back. A reports worker never takes this queue in production: `superset-worker-assistant` has its own slots, with
  `CELERY_QUEUES`; dev shares them to save memory. Undo stays in the request, and answers 409 during a turn.
- **The editor's copilot** (mode `edit`, the Assistant tab of `BuilderComponentPane`, Home › Assistant in the ribbon,
  `AssistantChat` in `AssistantPanel.tsx`). It works on the saved report: with unsaved changes the panel asks to save
  (`saveReport`, which stays in the editor through `keepEditingOnSave`) or discard, and after an answer that changed
  something `reloadReport` hydrates again without leaving the editor; unsaved work made during the answer is never thrown
  away. `editorContext` adds the page and the selected objects with their format. The context is data for the model:
  `dashboard_id` is the only part the server reads.
- **Confirmations are a security boundary.** A tool that deletes, overwrites, publishes, shares, schedules, restores or
  moves (`_needs_confirmation`, `CONFIRM_TOOLS` in `tools.py`) stops the loop: none of that turn's tools run, the turn is
  stored without results plus an `awaiting` record (role `record`, never sent to the model), and that is the whole pending
  state (`pending_turn`), with no table of its own. `POST .../conversations/<id>/decide/` takes only `tool_use_id` and
  `approved`: what runs is the stored call, for the owner of the conversation, who is checked again (`can_edit_resource`)
  at that moment. The decision is written first, on a position read before anything else (`ConversationLog` is built right
  after `find_conversation`): the unique `seq` lets one of two racing requests through before any tool runs, and once results are stored the call stops being pending, so a decision works once. `ToolBox.call` refuses these
  tools without `approved=True`, which only `_run_tools` passes, from a stored decision. Text of the model or of a tool
  cannot approve anything; a person who writes instead of deciding moves on, and the calls get a "not run" result. Each
  call gets a `tool_result`, a rejected one too, and a rejection holds back the plain calls of its step. A new tool that
  matters to a person gets a Spanish title in `confirmations.ts` (`copilot_test.py` checks it). Calls run through
  `ToolBox.call`, which is the place to mark what the assistant did.
- **Undo** (`undo.py`, `POST .../conversations/<id>/undo/`): `turn_start` (right before the first change, so what anyone saved
  while the model thought or a card waited stays) and `turn_end` records hold the versions of the dashboard and its charts
  around a turn; undoing runs the restore commands as the person, charts included, because a
  dashboard version has no chart content. It refuses (409) when the report changed after the turn, and each undo uncovers
  the turn before. A dataset the turn changed, a chart it created (left out of the report) and a chart it deleted stay as
  they are.
- **Who may use it** (`governance.py`, read on the server in chat, decide and undo; the panel only reflects it): the global
  switches of `AssistantSettings` (`enabled`, `edit_enabled`) and, per workspace, `WorkspaceAssistantSettings`, which can
  only narrow them. A dashboard without a workspace follows the global ones. The admins of a workspace and the platform's
  change them (`/api/v1/auradata_assistant/workspace/<id>/`, «AI assistant» in the menu of the workspace page), never a
  contributor. A workspace and a person each have one key-value entry (`KeyValueResource.AURADATA_ASSISTANT`), so saving one
  never overwrites another, and no table is needed. The workspace is read at each request, because dashboards move.
- **Spending** (`spending.py`, the only place for the month, the rounding and the limits): a month is a calendar month of
  the clock of `created_on`, from its first instant up to and excluding the next; amounts are `Decimal` to the millionth, the
  precision of the column. `budget_level` warns at 80% and stops at 100%, exactly; `None` sets no limit and `0` stops from the
  start. The check runs before a new turn (429, `reason: budget`): a turn under way finishes, so `decide` never stops for a
  limit, and `undo` costs nothing. A person using the panel only learns a level (`budget` in `models/` and `done`), never an
  amount. Figures in dollars: Administration › AI assistant › Usage (`/api/v1/auradata_assistant/usage/`, admins) and the
  month of one workspace for its admins.
- **Votes on answers** (`feedback.py`, table `auradata_assistant_feedback`, `AnswerActions.tsx`): under a finished answer,
  never one streaming or with a card waiting, the panel copies it (`figureAsText` adds its rows, separated by tabs) and takes
  a thumbs up or down, plus an optional reason of a fixed list (`REASONS`), never free text.
  `PUT`/`DELETE /conversations/<id>/messages/<id>/feedback/` answer 404 for anything but an answer of the voter's own
  conversation. A vote goes on the first row of the answer: `ConversationLog.answer_id` reaches the panel as `message_id` in
  `done` (a stream that fails before that has none), and a turn resumed from a card keeps the first. One row per message
  and user, in a table of its own, so a vote never touches a message or the conversation. A vote outlives a deleted
  conversation, detached and without its reason. Only totals leave the table for others: `usage_report` counts them
  by model and workspace, in the month of the answer, for admins, without reasons or text.
- **Managing conversations** (`ConversationList.tsx`, a view of the panel opened from its top row; `conversationGroups.ts`):
  search by title in the browser, groups by date of the last message (`last_message_on`, since `changed_on` moves on a rename
  and not on a message). `PUT`/`DELETE /conversations/<id>/` answer 404 to anyone but the owner. A rename changes `title` only.
  Delete needs no switch or report, and answers 409 during a turn, whose last write would lose its cost; it deletes the stream too.
- **Deleting and retention** (`conversations.py`, `retention.py`, `superset/tasks/assistant_retention.py`): `erase_conversations`
  is the only way to delete. It removes all a conversation holds and keeps the `assistant` rows, with `content` set to `[]` and
  no `conversation_id`, and their votes, so `spending.py` sums the same rows before and after and a deletion never refills a
  limit. There is no ledger and no second source of spending. The keys to a conversation stay `CASCADE`, so any other deletion
  takes the content and the totals. `auradata_assistant.purge_conversations` (nightly, in `CeleryConfig.beat_schedule`) deletes
  what is past `AURADATA_ASSISTANT_RETENTION_DAYS` (90; None or a nonsensical value keeps everything, orphans too), by last
  message, and orphans (`dashboard_id` or `user_id` empty; a report in the trash keeps its id). It counts and logs first, takes
  `dry_run`, works in batches judged again under `FOR UPDATE SKIP LOCKED`, and never touches a pending card or a running turn.
- **Attached images** (`attachments.py`, table `auradata_assistant_attachments`, `AttachedImages.tsx`, `useComposerImages.ts`).
  An upload is hostile. `POST /api/v1/auradata/assistant/attachments/` (one `image` per form, 8 MB, under the 10 MB of the proxy)
  goes through `clean_image`, the only way in: `Image.open` with `formats` limited to PNG, JPEG and WEBP, so the type comes from
  the bytes and SVG or GIF never decode; the size is read from the header and refused past 40 MP before a pixel is decoded; the
  result is a new image built from pixels (`Image.frombytes`, because saving reads `info` and a copy would keep the ICC profile
  or EXIF), upright, fit to 2576 px and 4784 visual tokens and to the 5 MB of `MAX_IMAGE_BASE64_CHARS`. Anything stored must
  stay acceptable to the API forever: the history only grows and is resent, so one bad image would break its conversation. A
  message holds `{"type": "auradata_attachment", "id"}` and `with_images`, called by `history_of` and by the chat for the new
  turn, makes the `image` block from the stored bytes, the same on every request, so the prompt cache holds. That custom type
  also means a path that forgets `with_images` gets a 400 instead of a silent loss. An upload is a draft of its `user_id` until
  `add_user_message` claims it, in the commit of the message (a lost race is a 409); `MAX_DRAFTS` and `purge_drafts` (nightly,
  after a day, also with no retention) keep them from piling up, and only a draft can be deleted. 5 per message and 20 per
  conversation (`MAX_PER_MESSAGE`, `MAX_PER_CONVERSATION`). `GET .../attachments/<id>/` answers 404 to anyone but the owner, an
  admin too, and for a report the owner can no longer open, with a fixed type, `nosniff` and `no-store`. `erase_conversations`
  deletes them. The panel shows only that endpoint, never a local preview, and `AssistantMarkdown` still loads no pictures: only
  a person attaches an image. Text inside an image is data (`RULES`), though it arrives in a user turn. Tokens of images are in
  `usage`, so limits and the context warning need nothing more. Paste leaves text alone when the clipboard also has it (Excel
  adds a picture of the cells), and drop stops propagation for the editor's react-dnd.
- **Documents of the assistant** (`artifacts.py`, `artifact_blocks.py`, `artifact_tools.py`, tables `auradata_assistant_artifacts`
  and `auradata_assistant_artifact_versions`; `ArtifactPanel.tsx`, `ArtifactBlocks.tsx`, `artifact.ts`, `useArtifact.ts`,
  `useBlockData.ts`). A document belongs to one person, report and conversation, in blocks of `text`, `figure`, `chart` and
  `table`, and each change is a new version; the last one is the document, and going back copies an earlier one
  (`restore_version`, 409 during a turn). `artifact_blocks.py` is the only shape: pydantic with `extra="forbid"` at every level,
  limits on every list and text, and a block of data has no field for a number, only a `query` in the words of `query_dataset`.
  `id` and `written_on` are stamped by the server. Text refuses raw HTML, pictures and links off this site when stored, and
  still goes through `AssistantMarkdown`. `query_problem` holds each query as the person (`user_can_view_data_model_metadata`,
  `resolve_dataset`, `raise_for_access`, `validate_chart_dataset`, names of the dataset) and fixes its time column, also on a
  restore. `create_artifact`, `change_artifact` and `read_artifact` are the assistant's own, never MCP tools: `ToolBox`
  offers them in both modes, not deferred and with no card, `changes_something` is False so a turn records no undo, and
  `ToolBox._call_own` runs them with the person of the turn, read again, because an MCP call ends the shared session. No input
  names a person: `OwnToolContext` comes from the turn, and a document of anyone else or of another conversation answers as one
  that does not exist. `change_artifact` takes the `version` it starts from, a list of changes that make one version, and
  refuses if the document moved. The action log keeps ids only (`log_params`): it outlives a conversation and a document does
  not. `artifact_of` reads what a call wrote from its result, like `figure_of`, so `tool_end` and a stored conversation agree
  (`artifact`, `artifact_calls`, `artifacts`). `find_artifact` is the only way to one: `GET /artifacts/<id>/`,
  `.../versions/<n>/` and `POST .../restore/` answer 404 to anyone but the owner, an admin too, and for a report they can no
  longer open; a key or guest gets 403. The panel runs each query through the chart data API with the viewer's permissions
  (`useBlockData`), keeps no number, and a block says when it is refused; `sources` only names the datasets the reader reaches.
  The browser sends `artifact: {id, block_id}` and `selected_context` reads the block from what is stored. Text does not follow
  the data, so a block of text carries `written_on`, the document shows its oldest date and refreshing it is a message.
  `erase_conversations` deletes the documents of a conversation, retention included; a restore leaves a `record` row, which
  counts as activity. `ArtifactPanel` is a portal next to the chat (`useDockBox`), in the drawer and in the editor's pane alike.
  Each version keeps the `model` that wrote it (a restore copies it); `DocumentMark` shows it as «made by the assistant (model X)».
  `query.aggregates[].label` names a number in legends and table headers instead of `SUM(ventas)`.
- **A document on its page, exported and shared** (`sharing.py`, `exports.py`, `artifact_pages.py`, `superset/tasks/assistant_export.py`;
  `DocumentPage.tsx`, `ShareCard.tsx`, `sheets.ts`, `WorkspaceDocuments.tsx`). `/assistant/document/<id>/` is the reading view, only a
  shell: `GET /api/v1/auradata/assistant/documents/<id>/` decides. It gives the owner the last version and a member of the workspace
  the shared one, and anyone else a 404, an anonymous visitor too, which is why that route has no `protect()`. A share is three columns of
  the document (`shared_workspace_id`, `shared_version`, `shared_on`), never a copy, and `sharing.reads_share` decides on every read:
  the report is still in that workspace, its author is still an active member, the reader has a `WorkspaceMember` row (a Superset
  admin is no exception) and opens the report as themselves, so a document of a draft stays with those who see the draft. Leaving a workspace
  and moving a report also clear the columns (`end_shares_of_member`, `end_moved_shares`), so coming back reopens nothing. The owner
  shares the version the card showed (409 otherwise), so what the assistant writes later reaches no reader until shared again. `reader_json`
  builds what a reader gets: no conversation, no history, and a data block they do not reach is `{id, type: "refused"}`: its query,
  title and label stay on the server. A block they reach runs its query in their browser, with their permissions and row level security. Text
  reaches nobody's permissions, so `share_card` lists the numbers it holds and the warning is plain. A reader writes nothing, and a
  shared text never reaches the model of a reader: `read_artifact` stays with the owner. Sharing and exporting are of the person: no
  tool of the model does either. Each leaves an `assistant_document` row in the action log, with the model.
  **PDF:** `POST .../artifacts/<id>/export/` writes a ticket in Redis and queues a task with its id; the panel asks until
  `GET .../export/<job>/` gives the file. The worker opens the reading view as the person with `capture_raw`, as report exports do. Captured
  (`standalone`), the page waits for every block (`useSettled`) and for ECharts, lays its pieces out on sheets (`sheets.ts`), and only then
  adds `auradata-document-ready`, the element the driver waits for; `exports.py` cuts the picture into PDF pages. It runs in a
  thread of its own, because sync Playwright leaves a loop running on its thread, which is also why tools go through `run_coroutine`.
  **Save as a page:** `save_artifact_as_page` is the one own tool with a card: edit mode only, `needs_confirmation` and `changes_something`
  True, so the turn records an undo like any other. `artifact_pages.py` plans the pages (`page_plan`, what does not fit goes on to more
  pages) and calls `add_page`, `add_element` and `create_visual` through `ToolBox`, so every rule of those tools holds. It reaches any
  document of the person on that report, so one written while reading can be saved from the editor. A query that no chart says
  exactly stays out of the report and the result names it: never a chart without one of its filters. `create_visual` takes `time_filters`.
- **The system prompt binds a conversation:** a stored thinking block is signed against the system prompt, the tools and the
  history. `conversation.system_prompt` holds the prompt of its first turn and every later turn resends it (`_prepare_turn`), so editing
  `prompt.py` reaches new conversations only; to tell a running one something, write a message of the conversation. Tools still change, with
  a person's permissions or a deployment, so every request sends `block_binding: {prefix_mismatch_behavior: "drop_block"}`
  (`THINKING_BINDING_BETA`, only with `adaptive` or `enabled`, which `between_tools` and `disabled` refuse): that conversation loses
  its reasoning and goes on, and `_note_dropped_thinking` logs it. A conversation older than the column takes the prompt of its next turn.
  What not even that saves (a signature the API cannot verify) is `history_refused`, and the panel offers a new conversation.
- **Privacy notice** (`PrivacyNotice.tsx`, `accept_privacy`): until a person accepts, per user on the server, chat and decide
  answer 403 (`reason: privacy`) and nothing reaches Anthropic. A change to what the notice says raises
  `PRIVACY_NOTICE_VERSION`, and everyone is asked again.
- **Commands of the panel** (`commands.ts`, `useCommandMenu.ts`, `CommandMenu.tsx`): `/` in the composer opens a list that `aria-activedescendant`
  keeps from the keyboard, with the focus in the text (a `textarea` keeps its `textbox` role). Each command has an English and a
  Spanish name, both always valid, and shows the one of the language (`t('/new')`). They are shortcuts: `commandCanRun` in
  `AssistantPanel.tsx` shares its conditions with the buttons they stand for, they add no permission, and the model only
  sees the plain question of `/summary`. A whole message naming a command never goes to the model, also after Escape or when it
  cannot run (a toast says so); anything else that starts with `/` is a question. A new command goes in `COMMANDS` and `commandCanRun`.
- **The mark of the AI:** the MCP middleware does not run in the web process, so `ToolBox.call` writes one
  `assistant_tool_call` per call to the action log (`action_log.py` keeps it; the page names the model and has a «Done by»
  filter). A save made inside a tool carries a `__agent__` record first on each entity (`acting_model` in
  `versioning/changes/state.py`, a context variable because the tool commits on a session of its own). `action_kind` stays
  as it was, so a restore by the assistant still reads as a restore. History: `by=assistant` in `/activity/`, a line on the
  save, and `assistant_model` in `list_versions`.
- **«Ask your data»** (`src/auradata/assistant/`): the panel of the reading view, read only, opened from `ReadingBar` (a
  floating button on phones, which have no bar) and only when `GET /api/v1/auradata/assistant/models/` says `available`.
  `client.ts` reads the SSE body of a `fetch` with the CSRF token of `SupersetClient`, which does not stream; `transcript.ts`
  turns events and stored rows into the same messages. A figure comes from the last `query_dataset` of an answer
  (`superset/auradata/assistant/figures.py`, `figure_of`), so nothing new is stored and the model has no say in its source;
  the panel repeats that query through the chart data API (`figure.ts`), which decides access, and keeps the rows as a table
  if it refuses or the shape does not fit a chart. Text goes through `AssistantMarkdown`: raw HTML stays text, no pictures,
  and only links of this site, because an injected instruction could carry data away in an address. The page and filters
  travel in `context.ts`, under the size the server takes. A model without tool search cannot take over a conversation of
  one with it.
- **The MCP drives the whole product** (`superset/mcp_service/`, its own `CLAUDE.md`): workspaces, report pages and
  objects, visuals, format, elements and slicers, interactivity, mobile layout, capture and export, sharing,
  scheduled reports, trash and history, the data model, and `auradata://` guidance with Spanish prompts. Tools write
  layouts through the Python layout library (`superset/auradata/layout/`) and the same commands as the web. A tool
  change regenerates `docs/auradata/mcp/referencia.md` (`scripts/auradata/mcp_reference.py`;
  `tests/unit_tests/mcp_service/test_reference_doc.py` fails when it is stale).
- **Docs** live in `docs/auradata/`: `manual/` (users, Spanish, with screenshots), `asistente/` (`administracion.md` for
  operators, `evaluacion.md`), `mcp/conectar.md` (connecting an AI),
  `mcp/referencia.md` (generated), `mcp/evaluacion.md` (end to end checks) and `arquitectura.md` (developers).
- **Flags fixed by the product** (`FORCED_OFF_FLAGS`, `superset/utils/feature_flag_manager.py`): Superset's mobile consumption mode
  (`auradataMobile` replaces it) and Table V2 stay off whatever the configuration says.
- **Soft delete and version history** (on by default since 7.0): a deleted dashboard, chart or
  dataset keeps its row (`deleted_at`) and links. The trash lives on the workspace page (contributors and admins,
  `/api/v1/workspace/<id>/trash/`) and in Administration (`/archived/`, "Papelera"); the history opens from the "…" menu of a
  dashboard. A contributor reads the history, copies dashboards (the copy keeps the original's editors and workspace) and lists
  the drafts of the workspace, never becoming an editor. Fork rules count only live rows: 7.0's ORM
  visibility filter hides them from ORM queries, but queries over link tables (`dashboard_slices`,
  `auradata_workspace_*`) must join the live rows themselves (`_live_links` in `single_dashboard.py`).
- **Datasets belong to a workspace** (`AURADATA_WORKSPACE_DATASETS`, `superset/auradata/workspace_datasets.py`),
  like Power BI semantic models: a dataset is in one workspace at most, and one without a
  workspace is shared. Only members (and editors, admins) list a workspace's datasets
  (`WorkspaceDatasetFilter` on the dataset API), and a chart only uses datasets of its
  dashboard's workspace or shared ones (`validate_chart_dataset` in the chart commands). A
  dataset created from a dashboard's side panel joins its workspace (`linkNewDataset`); the
  workspace page lists them, and the `dataset_usable_in_dashboard` filter narrows the dataset
  pickers of the panel.
- **AuraData brand** (https://auradata.mx/brand-guidelines): the product is "AuraData BI", the
  Continua logo plus a "BI" tag rendered as HTML (`src/auradata/shell/brand.ts`, `ProductTag`), never
  drawn into the logo file. Write the company as "AuraData" (capital A and D). Outfit for text,
  Geist Mono for data and eyebrow labels; Azul Aura `#2563EB`, violet `#7C3AED`, green `#10B981`;
  the 100° blue→violet→green gradient only as a headline accent. Logos and icons live in
  `superset-frontend/src/assets/images/auradata/`.
- Branding, theme tokens, languages and chart palettes live in `superset/auradata_config.py`.
- **Databases offered:** PostgreSQL, SQL Server (pymssql), MySQL, Databricks, Amazon Redshift and DuckDB, as cards
  with their logo (`PREFERRED_DATABASES` in `auradata_config.py`, logos in `src/auradata/databases/dbImages.ts`). Their drivers
  are installed in the `dev` and `prod` targets of the `Dockerfile` (`prod` is `lean` plus the six drivers and a Playwright Chromium, not the
  batteries-included `superset` image); a new database needs its driver there too. The dev and prod `CeleryConfig` inherit
  `superset.config.CeleryConfig`: never replace it, or Superset's own scheduled tasks (trash and history purge) stop running.
- **The editor has a ribbon, as in Power BI** (`src/auradata/ribbon`): Home, Insert, Design and View,
  plus Format and Data and drill for the selected object. It lives under the top bar in `Header`, and
  commands of the ribbon call the same actions as the panes. A new command goes there, in a named
  group; settings stay in the panes (`BuilderComponentPane`: charts, elements, format, selection,
  bookmarks), which `openBuilderTab` opens.
- **A report's title and actions sit in the top bar** (`useReportHeaderSlot`, `src/auradata/shell/reportHeader.ts`): `Header`
  portals them there, and keeps them over the page without a top bar (standalone, embedded, phones).
- **Pages share one margin:** `--mb-space-gutter`, `--mb-space-page-top` and `--mb-space-section` (`ThemeVariables`), tighter in
  the side panel (`body.auradata-panel`). A list shows one row of filters and folds the rest under «Más filtros» (`ListView`).
- **Pages out of a report share one chrome:** the shell draws the breadcrumbs (`ShellCrumbs`, from the navigation plus
  `usePageCrumbs`), and each page a title row with its commands in groups (`PageHeader`, `CommandGroup` in
  `src/auradata/shell/PageHeader.tsx`; the `.menu` header of the lists matches it in `skin.css`). Lists are dense tables with
  figures and dates in Geist Mono (`auradata-figure` cells, set in `TableCollection`). A report in reading view has a row of
  commands under the top bar (`src/auradata/report/ReadingBar.tsx`: view, filters, export); the editor keeps the ribbon.
  The first row of the window, above the top bar and the sidebar, is a desktop-style menu bar (`MenuBar` in
  `src/auradata/shell/MenuBar.tsx`, the `auradata-menubar-row` slot of `AppShell`, `menuBarSlot.ts`): File, View, Go to and Help
  on every page (`AppMenuBar`), File, View, Filters, Export and Share on a report (`ReportMenuBar`, the actions of its
  "⋯" menu, which stays, and hidden on phones and while editing).
  The last row is a status bar (`StatusBar`: server state, page figures from `usePageStatus`, language, theme; not on
  reports, which have the page bar). File › Open recent lists the dashboards opened in this browser
  (`recentDashboards.ts`, kept by `ReportMenuBar`). A ListView takes `rowMenu` for a right click on a row
  (`useContextMenu`); the dashboard list builds it with `useDashboardRowMenu` (`src/auradata/dashboards/rowMenu.tsx`).
- **The look is fixed by the product.** There are no saved themes and no CSS templates: no
  theme screen, API or per-dashboard theme, and `ThemeController` only switches between the
  `THEME_DEFAULT` and `THEME_DARK` of the configuration (light, dark, match system). Set
  `THEME_DARK = None` to force a single look. A dashboard keeps its own `css` field.
- Everything is named `auradata`: modules (`superset/auradata`, `superset/auradata_config.py`, `src/auradata`,
  `src/assets/auradata`), identifiers, `data-test` ids, the `/api/v1/auradata/` API, settings and env vars
  (`AURADATA_*`), the deployment files (`docker/auradata`) and every persisted name: `auradata_*` tables,
  `meta.auradata*` layout keys, `auradata-*` component keys, the `auradata` palette id, `auradata_*` form data keys,
  the `auradata-drillthrough` data mask, `.auradata-*` classes, `data-auradata-*` attributes, `--auradata-*`
  variables, `__auradata*` series ids, `localStorage` `auradata.*` and the `auradata_panel`/`auradata_dock` URL
  parameters. The old internal prefix `mibi` only survives in the names of historical migrations; migration
  `a7e3c91d4b60` renamed the stored data, and `tests/unit_tests/auradata/naming_guard_test.py` fails if it comes back.

### Where the code lives
| Area | Backend | Frontend (`superset-frontend/src/`) |
| --- | --- | --- |
| App shell, home, lists | `superset/auradata/previews.py`, `superset/auradata/api.py` | `auradata/shell`, `auradata/home`, `auradata/dashboards`, `assets/auradata/skin.css` |
| Workspaces and access | `superset/auradata/workspaces.py`, `workspace_access.py`, `models.py` | `auradata/workspaces` |
| Data page and datasets | `superset/auradata/data_views.py` | `auradata/data` |
| Format pane, cell grid | - | `auradata/format` |
| Chart format controls (labels, legend, axes, series, rules, table) | - | `explore/components/controls/{FontControl,SeriesColorsControl,ChartConditionalFormattingControl}`; sections in `packages/superset-ui-chart-controls/src/sections/visualFormat.tsx`; helpers in `plugins/plugin-chart-echarts/src/utils/formatting.ts` and `plugins/plugin-chart-table/src/utils/tableFormat.ts` |
| Background and element pictures | `superset/auradata/backgrounds.py` | `auradata/format/actions.ts`, `auradata/elements` |
| Design elements (image, shape, button, text, canvas filter) | - | `auradata/elements` |
| Filter bar levels (all pages / this page / visuals), instant apply | `dashboards/schemas.py` (`filter_bar_auto_apply`) | `dashboard/components/nativeFilters/scopeLevel.ts`, `FilterBar/` |
| Presentation mode, PDF/PNG export | - | `auradata/present`, `auradata/export` |
| Ribbon and lineage | - | `auradata/ribbon` |
| Selection pane, locked and hidden objects, page menu | - | `auradata/format/SelectionPane.tsx`, `auradata/format/lock.ts`, `auradata/report/PageMenu.tsx`, `auradata/report/pageActions.ts` |
| AI assistant, editor's copilot, attached images | `superset/auradata/assistant/` | `auradata/assistant` |
| Report interactivity (edit interactions, drill through, sync slicers, bookmarks, Back/bookmark buttons, tooltip pages, reset filters) | - | `auradata/report` |
| Chart type icons | - | `auradata/vizIcons` |
| Layout model in Python, format catalog | `superset/auradata/layout/`, `superset/auradata/catalog/` | `auradata/format/layoutDrift.test.ts`, `formatCatalog.test.ts` write their fixtures |
| MCP tools for AI clients, «Conectar IA» | `superset/mcp_service/` (`workspace/`, `report_layout/`, `history/`, `guidance/`…) | `auradata/connectAi` |

AuraData BI APIs: `/api/v1/workspace/` (with `<id>/dashboards/` and `<id>/datasets/`),
`/api/v1/dashboard_background/<dashboard>/`, `/api/v1/dashboard_image/<dashboard>/<image>/`,
`/api/v1/auradata/dashboard_previews/`, `/api/v1/auradata_assistant/` (`settings/`, `usage/`, `workspace/<id>/`),
`/api/v1/auradata/assistant/` (with `models/`, `privacy/`, `conversations/`, `attachments/` and `artifacts/`). Each new API is registered in `superset/initialization/__init__.py`.

### Dashboard formatting lives in the layout
Formats are stored in `position_json`, so they save, undo and export with the dashboard:
- Canvases always have a fixed page size, as in Power BI (16:9 by default, 4:3, letter or custom;
  see `canvasSize`); 16:9 is Full HD, 60 × 34 cells (1920 × 1088 px), and the other presets
  share its height. There is no screen-width mode: a phone shows the same canvas, scaled to its width,
  unless the page has a mobile layout (below).
  While editing, the page is a limit: resizing stops at its bottom (`useMaxHeightMultiple`) and a
  change that overflows it fits the visuals back inside (`CanvasFrame`).
- `ROOT_ID.meta.auradataCanvas`: canvas format (`CanvasFormat` in `src/auradata/format/types.ts`),
  including `visuals`, the style every chart shares (from "Apply to all charts").
- `CHART-*.meta.auradataFormat`: a chart's own format. It wins over the shared style setting by
  setting; read it with `useVisualFormat`/`mergeVisualFormat`, never `meta.auradataFormat` alone.
- `CHART-*.meta.auradataFormat.chart`: settings of the chart itself, by form data key, over its saved
  `form_data` (`withChartFormat` in `src/auradata/format/chartFormat.ts`). A change repaints without a
  query, and a key here wins over the same key saved by Explore. A layout can take 512 KB
  (`SUPERSET_DASHBOARD_POSITION_DATA_LIMIT`).
- The Visual level of the Format pane draws the look controls of each chart's control panel with
  Explore's `Control` (`auradata/format/ChartFormatSections.tsx`), sorted into the sections of
  `auradata/format/formatCards.ts`. A new control of a chart shows by itself; give it a section there.
  A control declared twice, as bars do for each orientation, shows the version whose `visibility` applies. A control
  that reports its value on mount changes nothing: `setValue` ignores a value equal to the current one.
  The editor docked beside a report only has the data tab. Settings tied to one chart
  (`OWN_CHART_SETTINGS`) and what names one chart (subtitle, header help text, action, action button) stay out of "Copy
  format" and "Apply to all charts" (`sharableFormat`, `ownFormat`).
- Bars, lines, areas and combos have more options in `plugins/plugin-chart-echarts/src/utils/chartFormatOptions.ts`:
  `applySeriesFormat` for one series, `applyChartFormat` for what takes the whole chart (color scale, label blocks,
  total labels, series labels, legend title, plot area, category scroll) and the `*AxisFormatOptions` for the axes.
  A value of the shared `gridline_*` keys is the fallback of `x_gridline_*` and `y_gridline_*`. `series_format` holds what
  a series changes by name (`SeriesFormatControl`). Total labels are marks of no height at the end of each stack, and a
  legend title is a series without marks: both have ids starting with `__auradata`. `CardDefinition.headings` starts a group
  inside a section of the pane.
- Cards and special ECharts charts use `sections/chartFamilies.ts` for their extra controls. Card HTML text and KPI
  status are resolved in `BigNumber/cardFormat.ts`; an optional `goal_metric` belongs to Data and uses the indicator's
  aggregation, while `kpi_target_value` only repaints. No goal keeps the older comparison behavior. Zero is a valid goal;
  a percent distance from zero is N/A. `utils/specialChartFormat.ts` preserves original data shapes, helper series and hooks;
  scatter's shared formatting has already run, so do not apply it twice. Ratio/shading require numeric linear axes.
  Card value controls are unified: `legacyCardFormat` reads older `value`/`label` styles as defaults, and card text sets
  local CSS variables so explicit font settings beat the older important rules without rewriting layouts.
  Fixed targets, labels and category mappings belong to `OWN_CHART_SETTINGS`. A donut's center takes an image of this
  site or a data address (`center_image`, `sameOriginImage`: an image of another host would taint the canvas and break
  exports) and a label on its own (`center_label`); a waterfall keeps its `waterfall_max_breakdowns`
  largest breakdowns per period and adds the rest up; a gauge can read its target from a field (`gauge_target_metric`,
  a query control). Treemap tiling alternatives (ECharts only has squarify) and automatic marker containment are still
  open; do not expose controls for them until implemented. Roadmap state is in `docs/plans/estado-formato-powerbi.md`.
- Lines, areas, steps and smooth lines move a series to a secondary Y axis from `series_format` (`axis: 'secondary'`,
  `applySecondaryAxis`); the chart keeps one axis object until a series moves, and bars and charts drawn across never
  get one. Zoom sliders take values instead of percents (`zoom_in_values`) and reach that axis (`zoom_secondary_*`).
  `value_label_density` hides the label of all but every step-th point. The combo's tooltip fields are a third query by
  the X-axis only. A matrix freezes its row headers (`table_freeze_row_headers`, offsets measured per level in
  `TableRenderer`) and its value cells open tooltip pages. Small multiples read their grid format from `matrixify_grid_*`,
  `matrixify_cell_*` and `matrixify_header_*` (`matrixifyGridStyle`). A table can describe the images of a row by another
  column (`table_alt_text_column`) and name its rows by one (`table_row_reference_column`, a `rowheader` cell).
- A control goes in the first section of `CARD_DEFINITIONS` that names it, and `table_cell` only exists for tables.
- Tables and matrices share render-only controls and scoped CSS in
  `packages/superset-ui-chart-controls/src/sections/tableFormat.ts`; the plain table keeps its existing
  `tableFormat` helper, and the pivot renderer receives raw `tableFormat` from `transformProps`.
  Extended column styles are enabled only by `tableFormatting` in the two supported control panels;
  do not expose them through the default column editor of another renderer without implementing them.
  Matrix sparklines use existing column groups, table sparklines require ordered numeric arrays, and
  neither introduces a new query role. Resolve result-dependent choices before control validation,
  and merge pending column edits before sending a debounced update.
- The General level also covers header icons (`auradata/format/HeaderExtras.tsx`), action button and
  chart link (`format.link`, `format.actionButton`), spacing, and the tooltip and sampling of
  ECharts (`chart.auradata_tooltip`, `chart.auradata_sampling`), which reach the chart through
  `data-auradata-echarts` on the holder (`echartsHostFormat`, `applyHostFormat`).
- Design elements are `DYNAMIC` components whose `componentKey` starts with `auradata-`, with their
  settings in `meta.auradataElement` (`src/auradata/elements/types.ts`).
  The canvas filter element (`auradata-filter`) stores `filterId` and `showInFilterBar`; filters
  with `showInFilterBar: false` are left out of the filter bar (`useCanvasOnlyFilterIds`).
- The canvas is a grid of square cells of `CELL` = 32 px (`src/auradata/format/types.ts`). Its size
  is a whole number of cells, so its width in cells is the number of columns of the layout. Every
  `meta.width` and `meta.height` is in cells, there are no margins or gaps between objects, and the
  edit-mode grid always draws lines at every cell. Use `src/auradata/format/columns.ts`
  (`columnCountOf(layout)`, `gridColumnCount()`, `minObjectColumns()`), never `GRID_COLUMN_COUNT`.
  `layoutToCells` (`cells.ts`) converts layouts saved before the cell grid (12/24/48 columns, heights
  in 8 px steps, canvas padding and gap) on load; `ROOT_ID.meta.auradataCells` marks a converted layout.
- Charts, elements and text boxes sit at an absolute cell of the page: `meta.auradataPos` is `{x, y}` in
  cells from its top-left corner, so moving or resizing one never moves another. Rows stay as
  containers. A drop sets
  the cell from where the object lands (`src/auradata/format/positions.ts`, `DropResult.cell`, handled
  in `handleComponentDrop`); `layoutToPositions` gives a cell to every object without one on load.
  A chart added without a drop (saved from the side panel or Explore, or attached outside edit
  mode) takes the first free cell of its page (`freeCell`), never one over another object.
- `TAB-*.meta.auradataMobile` (`GRID_ID` for a report of one page) is the optional mobile layout of a page, as in
  Power BI: `{items: [{id, x, y, width, height}]}` in cells of a phone page `MOBILE_COLUMNS` (12) wide, back
  to front (`src/auradata/format/mobileLayout.ts`). It only places objects the page already has; read it with
  `mobileLayoutOf`, which drops boxes of objects that left the page. A phone (`usePhoneScreen`) shows it when
  the page has one and the canvas otherwise; nothing switches layout on its own. `DashboardComponent` gives
  each object its box (`mobileComponent`) and leaves out the rest. The editor opens it from View → Mobile
  layout (`useMobileEditing`): the page shows inside an iPhone (`DeviceFrame`, presets with points, pixels
  and safe-area insets in `mobileDevices.ts`) and scrolls only between its safe insets, `MobileLayoutPane`
  replaces the panes and the ribbon gets a Mobile layout tab. "Place" draws `MobileLayoutEditor` over the
  page; "Preview" shows it as a phone viewer sees it, or the scaled canvas when the page has no layout.
  Mode, device, fit and safe-area marks are a browser preference (`useMobileViewSettings`), never saved in
  the report. The canvas never fits its visuals while it is open. A phone viewer gives the page the whole
  width of the screen, less the closed filter rail, which a phone shows only when the report has filters
  (`useNativeFilters`). The preview draws what a phone viewer loses around the page (the app bars and that
  rail, `VIEWER_*` in `DeviceFrame.tsx`, measured on a phone 393 pt wide); keep them in step with the shell.
- The report is light or dark from the canvas background color (`useReportAppearance`); there are no
  appearance settings.
- `meta.auradataHidden` hides an object from viewers (faded for editors), `meta.auradataLocked` keeps it from
  being moved, resized or removed; both are set in the Selection pane (`auradata/format/SelectionPane.tsx`)
  and the object tabs of the ribbon. "Lock objects" locks the whole report for one editor, in the
  browser (`auradata/format/lock.ts`). `TAB-*.meta.auradataHiddenPage` hides a page from the tabs and the
  navigators of viewers; links and drill through still open it.
- `meta.auradataAltText` is the description of a chart for screen readers.
- Report interactivity (`src/auradata/report`), Power BI style:
  - `ROOT_ID.meta.auradataBookmarks`: bookmarks (page, filter and cross-filter selections, visibility).
    Applying one sets a browser-only visibility override (`visibility.ts`) on top of `auradataHidden`.
  - `TAB-*.meta.auradataDrillthrough`: `{columns}` a page accepts for "Drill through". The filter is the
    `auradata-drillthrough` data mask, scoped to that page's charts in `getAllActiveFilters`.
  - "Edit interactions" changes `chart_configuration` cross-filter scopes (filter or none; Superset
    charts cannot highlight); it saves with the dashboard.
  - "Sync slicers" sets the native filter scope (saved right away, like any filter setting) and
    places copies of the canvas filter on other pages (saved with the dashboard).
  - Tooltip pages: `TAB-*.meta.auradataTooltipPage` (`{width, height, columns}` in cells) makes a page a
    tooltip, hidden from viewers (`isHiddenPage`, also left out of the tab list) and edited at that size
    (`CanvasFrame`, objects past its edge are clipped). A chart picks one in General › Tooltips
    (`meta.auradataFormat.tooltipPage`: `type: 'page'`, `page` or none for Auto, the tooltip page whose
    `columns` the chart groups by). On hover, `Echart.tsx` and the table's cells call the plugin's own
    `contextmenu` handler with a probe mark (`data-auradata-probe`); `ChartRenderer` turns that call into a
    `auradata:mark-hover` event instead of the menu, and cards (`WHOLE_CHART_TOOLTIP`) send one for the
    whole chart. `TooltipPageHost` draws the page's charts with `SuperChart` and its own queries
    (dashboard filters plus the mark's values, a date of a grain as a `TEMPORAL_RANGE`, outside Redux),
    plus its text boxes, images, shapes, buttons and texts; slicers and navigators are left out. Queries
    wait a moment, are cached by form data and aborted when the pointer leaves (`tooltipPages.ts`); the
    line of a series never replaces the point of it under the pointer (`isLessPrecise`).
  - "Reset filters" (`resetFilters.ts`, reading view and ribbon) sets every native filter and slicer to
    its default, clears cross-filters, leaves a drill through and drops bookmark visibility overrides.
- A fixed page shows a bar at the bottom, as in Power BI (`PageBar` in `auradata/report/TabsDock.tsx`), of a
  fixed size whatever the zoom: previous/next arrows, flat page tabs split by hairlines with the accent
  under the active one, "Page 1 of 3" and the zoom with a fit choice (`ZoomToolbar docked`); narrow bars
  drop the slider, then the fit choice. Presenting and the mobile layout keep the tabs above the page.
- With the page bar, the vertical filter pane is a pane of the report at its right edge, as tall as the
  page area and out of the page (`FilterDockTarget atEdge` in `CanvasFrame`); the page floats alone and its
  zoom does not count the pane. Presenting keeps the pane beside the page.
- The vertical filter pane stays beside the page while editing. Each filter is a card (`auradata/dashboard/FilterCard.tsx`):
  name and what it selects (`filterSummary`: "is (All)", "is North"), folded until opened (remembered in
  the browser), with the accent on its edge while it selects something; the folded rail counts the
  filters that select something.
- Write layout changes through `src/auradata/format/actions.ts` (`updateLayout`, `setVisualFormat`,
  `setCanvasFormat`, `setSharedVisualFormat`) so edits group into one undo step.
- A canvas filter of a list of values can draw itself as a dropdown, list, buttons or text box (`auradata/elements/SlicerView.tsx`,
  `meta.auradataElement.variant`). Only the dropdown is the filter plugin; the others ask for its values with `getFormData` and
  write the same data mask. A range filter can draw itself as "Between" boxes or a slider (`rangeStyle`) and a time filter as
  a relative date or two days (`dateStyle`, `RangeSlicerView.tsx`); the rules of selection, sorting, value format and time
  ranges live in `auradata/elements/slicer.ts`. A slicer's Format pane (`SlicerFormat.tsx`) has a Visual and a General level; the
  General level reuses `TitleSections`, `BoxSections` and alt text, and its title is drawn by `ElementTitle`; the title
  text of an element is its own and stays out of "Copy format". A filter that takes one value keeps one whatever the slicer
  says. `hiddenValues` leaves values out of one slicer only (keys from `slicerValueKey`); they still count in the charts.
  `SlicerIcons` draws the eraser, the header help text and the action of `meta.auradataFormat`. Not built: a hierarchy slicer
  (it needs an OR across columns that native filters cannot express).
- The Analytics level of the pane holds the cards with `level: 'analytics'`. `utils/analyticsFormat.ts` draws
  `reference_lines` and the trend line as series with `__auradata` ids, and the zoom sliders. `tooltip_metrics` are a second query
  of the timeseries charts, so they never change the series. Small multiples are Matrixify, opened to the pane without its flag.
- `DASHBOARD_VIRTUALIZATION` stays off: rows have no height and the page scrolls inside its own container, so row observers
  would unmount every chart on scroll. Playwright hides this kind of bug: `navigator.webdriver` turns virtualization off too.
- The Fields level of the pane (`auradata/format/ChartFieldsSections.tsx`) draws the query controls of a chart with Explore's
  `Control`; `chartFields.ts` names them by role. Fields are chart settings, never layout ones: a change previews through the
  chart's form data and `saveChartFields` writes it to the chart, with a new `query_context`, when the report saves. A key the
  layout holds moves out of it. Tooltip fields and small multiples stay in the layout. Undo follows them: each field change is a step whose number goes in `ROOT_ID.meta.auradataFieldStep` while its values stay in memory (`followFieldSteps`, mounted by `BuilderComponentPane`), so the layout never holds fields. A field also goes on a chart from its box in the Data pane or dropped on the chart (`FieldDropTarget`), into the well `addFieldChange` picks. «Use this table in the chart» moves a chart to another usable dataset in one undo step (`changeChartDataset`, dropping what `fieldsKeptBy` says the new one lacks); saving sends `datasource_id` and a refusal of the server reverts the chart. The Data pane drags with dnd-kit, as Explore: `DashboardBuilder` wraps the dashboard in `ExploreDndContextProvider`. `auradata/format/DataPane.tsx` is the Data pane.
- There are no saved format themes: each dashboard is formatted on its own.

### Superset 7.0 under the fork
Things that changed in 7.0 and that the fork code relies on:
- **Routes have no `/superset/` prefix** (`/dashboard/<id>/`, `/welcome/`, `/explore/`, `/sqllab/`); the backend never
  emits the old ones (7.0 redirects old links). Use `REPORT_PATH`/`HOME_URL` of `src/auradata/shell/navigation.ts`.
  `isReportRoute` leaves out `/dashboard/list/` and `/dashboard/new/` (the router would read them as a slug); "New
  dashboard" is a full navigation, because its GET on the server creates the dashboard.
- **Editors and viewers replace owners and roles-with-access.** There is no `owners`, `is_owner` or
  `raise_for_ownership`: use `editors`/`viewers`, `security_manager.is_editor` (which also grants data access) and, for
  edit points, `can_edit_resource`/`raise_for_editorship` (see Workspaces above). Chart fields read the editors of
  the chart in the browser (`canChangeFields`).
- **SQLAlchemy 2.0 and Flask 3**: `session.get`, no `Query.get`; commit between changes of the same dashboard links
  (version history records one change per link and transaction).
- **Frontend**: React 18, antd 6 (`styles.container` in tooltips, `.ant-tabs-body`, `Drawer size`), oxlint and oxfmt
  instead of ESLint, `lodash-es`, `renderHook` from `@testing-library/react`, dnd-kit in Explore. The lockfile is
  npm's; run `npm run plugins:build` before `tsc`. In a worktree without `node_modules`, clone them (and the nested
  ones of `plugins/*` and `packages/*`) with `cp -cR` from another checkout of the same lockfile.
- **Flags the product fixes**: `MOBILE_CONSUMPTION_MODE`, `AG_GRID_TABLE_ENABLED` and `TABLE_V2_TIME_COMPARISON_ENABLED`
  stay off (`FORCED_OFF_FLAGS`).
- **Month and day names** of axes and dates follow the language of the app (`src/setup/localeTimeFormat.ts`, from
  `Intl`) unless `D3_TIME_FORMAT` sets them; ECharts' own locale (`echartsLocale.ts`) is loaded per language too.
- **Reports and alerts** run as the report's editor (`ALERT_REPORTS_EXECUTORS`) and need access to the dashboard: a
  draft is visible only to its editors, admins and the contributors and admins of its workspace. A scheduled report
  of an unpublished dashboard whose executor is none of those stops running in 7.0: publish the dashboard, or make its
  editor an editor of the dashboard or a contributor of the workspace. `ALERT_REPORTS_EXECUTORS` falls back to a
  fixed admin only if the operator accepts that report images are taken with admin rights.
- The prod `CeleryConfig` inherits `superset.config.CeleryConfig`; `prod` is `lean` plus the six drivers and Chromium.

### Migrations
Fork migrations form one chain after the Superset 6.1 head (`4b2a8c9d3e1f`; they were written on 6.1 and stay in that order):
`8bc9e5b95335` (workspaces) → `cce7fe34b50d` (members) → `3a90eb47d506` (backgrounds) →
`06c8a16b9fe1` (element images) → `b7d41e0c9a23` (format themes) → `e4ec3b61cadb` (drops the
format themes) → `a91c5d27f3e8` (drops the annotation layers) → `c5f08a1d7e42` (drops the
themes and CSS templates) → `d3f9a2b17c64` (workspace datasets). The chain ends in the merge revision
`f1c7a9e2b305`, whose `down_revision` is the Superset 7.0 head (`88a01c781622`) and the fork head, so there is
one head and a database at `d3f9a2b17c64` still runs the 41 migrations of 7.0 on `db upgrade`. After the merge comes
`a7e3c91d4b60` (renames the persisted `mibi` names to `auradata`).
After it comes `c6a1f4e09b27` (conversations of the assistant), then `b2d58e7a13c4` (votes on its answers),
`e5a7c3f19d42` (rows that outlive a deleted conversation), `c8f2d6b4a917` (images attached to the assistant),
`d47b1e9a6c30` (how much of the context each answer took) and `f3c9a1e7d258` (documents of the assistant).
- A new fork migration revises the current head (`f3c9a1e7d258` until the next one).
- Each new Superset release follows the same rule: add another merge revision of its head and the fork head.
  Never repoint `8bc9e5b95335` (or any fork revision) to the new upstream head: a database that already ran the
  fork migrations would skip the new upstream ones.
- Check both paths on a throwaway database, never the dev one: a new database and a copy at the previous head
  must both reach the new head.

### Tests for AuraData BI code
- Jest tests sit next to the code (`src/auradata/**/*.test.ts(x)`).
- Backend: `pytest tests/unit_tests/auradata/`.
- Browser: `superset-frontend/playwright/tests/experimental/` (dashboard format, export,
  theme, stress), run with `INCLUDE_EXPERIMENTAL=1`.

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **Use @superset-ui/core** - Don't import Ant Design directly, prefer Ant Design component wrappers from @superset-ui/core/components
- **Use antd theming tokens** - Prefer antd tokens over legacy theming tokens
- **Avoid custom css and styles** - Follow antd best practices and avoid styling and custom CSS whenever possible

### Testing Strategy Migration
- **Prefer unit tests** over integration tests
- **Prefer integration tests** over end-to-end tests
- **Use Playwright for E2E tests** - Cypress has been removed from this fork
- **Use Jest + React Testing Library** for component testing
- **Use `test()` instead of `describe()`** - Follow [avoid nesting when testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing) principles

### Backend Type Safety
- **Add type hints** - All new Python code needs proper typing
- **MyPy compliance** - Run `pre-commit run mypy` to validate
- **SQLAlchemy typing** - Use proper model annotations

### UUID Migration
- **Prefer UUIDs over auto-incrementing IDs** - New models should use UUID primary keys
- **External API exposure** - Use UUIDs in public APIs instead of internal integer IDs
- **Existing models** - Add UUID fields alongside integer IDs for gradual migration

## Security and Threat Model

Before evaluating any code path for security issues, read [`SECURITY.md`](SECURITY.md). It is the canonical, authoritative source for Apache Superset's security model and is referenced by both human reporters and automated scanners.

In short, the test for whether a finding is in scope is one question:

> *Does it let a principal perform an action the role and capability matrix in `SECURITY.md` does not entitle them to?*

If yes, it is in scope. If no, it is not.

The three trust boundaries are:

1. **The Admin role** is a fully trusted operational principal. Anything an Admin can do through documented configuration, API, or UI is an intended capability, not a vulnerability.
2. **The operator** owns deployment-time decisions (secrets, network exposure, feature-flag selection, connector and codec choices, notification destinations, third-party plugins). Misconfiguration at this layer is a deployment defect, not a Superset vulnerability.
3. **The codebase** is responsible for enforcing the role and capability matrix wherever it exposes functionality to a principal: API routes, command and DAO layers, UI handlers, background jobs, and any other entry point. A missing or incorrect enforcement check is in scope no matter where it lives.

The security model assumes that operator-controlled infrastructure, including the metadata database, cache backends, message brokers, secret stores, and deployment environment, remains within the operator's trust boundary. Vulnerabilities must demonstrate a security boundary violation by an attacker who does not already control those systems.

Route-level authorization in this codebase uses one of three Flask-AppBuilder decorators depending on the route type:

- `@protect()` for REST API routes (`ModelRestApi` / `BaseApi`)
- `@has_access_api` for legacy view routes
- `@has_access` for legacy HTML view routes

Object-level authorization via `security_manager.raise_for_access(...)` applies to data-bearing resources: dashboards, charts, datasets and datasources, queries, database and table access, and query contexts. Other resources (annotations, tags, CSS templates, reports, RLS rules, and similar) rely on the route-level decorator plus DAO `base_filters` for ownership scoping; the absence of `raise_for_access` on these resources is by design, not a finding. Code that omits the per-object gate on a route that returns or mutates a specific data-bearing object is in scope; code that follows the correct pattern for its resource class can still contain injection, SSRF, XSS, or other classes of finding unrelated to authorization, which are evaluated separately.

The full role and capability matrix, in-scope and out-of-scope class lists, and CVE aggregation rules are in [`SECURITY.md`](SECURITY.md). Defer to that document for any specifics.

**Requirements for findings filed by automated tooling**

Automated scanners (LLM-based code scanners, static analyzers, dependency tools) that file findings against this codebase must, in each finding, name:

1. The specific role and capability matrix row in [`SECURITY.md`](SECURITY.md) the finding believes is violated.
2. The principal the finding assumes the attacker holds (Public, Gamma, sql_lab, Alpha, Admin, Embedded guest token, or a custom role with explicit capability grants).

Findings that cannot identify both should be filed as questions, not vulnerabilities. This requirement exists to ensure every reported issue is testable against the published security model and to keep speculative or pattern-match-only reports out of the triage queue.

## Key Directories

```
superset/
├── superset/                    # Python backend (Flask, SQLAlchemy)
│   ├── views/api/              # REST API endpoints
│   ├── models/                 # Database models
│   └── connectors/             # Database connections
├── superset-frontend/src/       # React TypeScript frontend
│   ├── components/             # Reusable components
│   ├── explore/                # Chart builder
│   ├── dashboard/              # Dashboard interface
│   └── SqlLab/                 # SQL editor
├── superset-frontend/packages/
│   └── superset-ui-core/       # UI component library (USE THIS)
└── tests/                      # Python/integration tests
```

## Code Standards

### TypeScript Frontend
- **Avoid `any` types** - Use proper TypeScript, reuse existing types
- **Functional components** with hooks
- **@superset-ui/core** for UI components (not direct antd)
- **Jest** for testing (NO Enzyme)
- **Redux** for global state where it exists, hooks for local

### Python Backend  
- **Type hints required** for all new code
- **MyPy compliant** - run `pre-commit run mypy`
- **SQLAlchemy models** with proper typing
- **pytest** for testing

### Apache License Headers
- **New files require ASF license headers** - When creating new code files, include the standard Apache Software Foundation license header
- **LLM instruction files are excluded** - Files like AGENTS.md, CLAUDE.md, etc. don't need the header, to avoid token overhead

### Code Comments
- **Avoid time-specific language** - Don't use words like "now", "currently", "today" in code comments as they become outdated
- **Write timeless comments** - Comments should remain accurate regardless of when they're read

## Documentation Requirements

- **Docstrings**: Required for new functions/classes

## Architecture Patterns

### Security & Features
- **Security model**: see the top-level [Security and Threat Model](#security-and-threat-model) section and [`SECURITY.md`](SECURITY.md)
- **RBAC**: Role-based access via Flask-AppBuilder
- **Feature flags**: Control feature rollouts
- **Row-level security**: SQL-based data access control

## Test Utilities

### Python Test Helpers
- **`SupersetTestCase`** - Base class in `tests/integration_tests/base_tests.py`
- **`@with_config`** - Config mocking decorator
- **`@with_feature_flags`** - Feature flag testing
- **`login_as()`, `login_as_admin()`** - Authentication helpers
- **`create_dashboard()`, `create_slice()`** - Data setup utilities

### TypeScript Test Helpers
- **`superset-frontend/spec/helpers/testing-library.tsx`** - Custom render() with providers
- **`createWrapper()`** - Redux/Router/Theme wrapper
- **`selectOption()`** - Select component helper
- **React Testing Library** - NO Enzyme (removed)

### Test Database Patterns
- **Mock patterns**: Use `MagicMock()` for config objects, avoid `AsyncMock` for synchronous code
- **API tests**: Update expected columns when adding new model fields

### Running Tests
```bash
# Frontend
npm run test                           # All tests
npm run test -- filename.test.tsx     # Single file

# E2E Tests (Playwright, from superset-frontend/)
npm run playwright:test                # All Playwright tests
npm run playwright:ui                  # Interactive UI mode
npm run playwright:headed              # See browser during tests
npx playwright test tests/auth/login.spec.ts  # Single file
npm run playwright:debug tests/auth/login.spec.ts  # Debug specific file

# E2E tests of AuraData BI screens (opt-in)
INCLUDE_EXPERIMENTAL=1 npx playwright test tests/experimental/dashboard/format.spec.ts

# Backend  
pytest                                 # All tests
pytest tests/unit_tests/specific_test.py  # Single file
pytest tests/unit_tests/               # Directory

# If pytest fails with database/setup issues, ask the user to run test environment setup
```

## Environment Validation

**Quick Setup Check (run this first):**

```bash
# Verify the app is running (docker compose up -d --build, see README.md)
curl -f http://localhost:8088/health || echo "❌ Setup required - see README.md"
```

**If health checks fail:**
"It appears you aren't set up properly. Start the stack with `docker compose up -d --build` (see README.md), or refer to the [Working with LLMs](https://superset.apache.org/docs/contributing/development#working-with-llms) section of the Superset development docs."

**Key Project Files:**
- `superset-frontend/package.json` - Frontend build scripts (`npm run dev` on port 9000, `npm run test`, `npm run lint`)
- `pyproject.toml` - Python tooling (ruff, mypy configs)
- `requirements/` folder - Python dependencies (base.txt, development.txt)

## SQLAlchemy Query Best Practices  
- **Use negation operator**: `~Model.field` instead of `== False` to avoid ruff E712 errors
- **Example**: `~Model.is_active` instead of `Model.is_active == False`

## Pull Request Guidelines

**When creating pull requests:**

1. **Describe the change**: Include a summary, before/after notes for UI changes, and testing instructions
2. **Follow PR title conventions**: Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
   - Format: `type(scope): description`
   - Example: `fix(dashboard): load charts correctly`
   - Types: `fix`, `feat`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# IMPORTANT: Stage your changes first!
git add .                        # Pre-commit only checks staged files

# Quick validation (faster than --all-files)
pre-commit run                   # Staged files only
pre-commit run mypy              # Python type checking
pre-commit run format            # Code formatting
pre-commit run oxlint-frontend   # Frontend linting
```

**Important pre-commit usage notes:**
- **Stage files first**: Run `git add .` before `pre-commit run` to check only changed files (much faster)
- **Virtual environment**: Activate your Python virtual environment before running pre-commit
  ```bash
  # Common virtual environment locations (yours may differ):
  source .venv/bin/activate      # if using .venv
  source venv/bin/activate       # if using venv
  source ~/venvs/superset/bin/activate  # if using a central location
  ```
  If you get a "command not found" error, ask the user which virtual environment to activate
- **Auto-fixes**: Some hooks auto-fix issues (e.g., trailing whitespace). Re-run after fixes are applied

## Common File Patterns

### API Structure
- **`/api.py`** - REST endpoints with decorators and OpenAPI docstrings
- **`/schemas.py`** - Marshmallow validation schemas for OpenAPI spec
- **`/commands/`** - Business logic classes with @transaction() decorators
- **`/models/`** - SQLAlchemy database models
- **OpenAPI docs**: Auto-generated at `/swagger/v1` from docstrings and schemas

### Migration Files
- **Location**: `superset/migrations/versions/`
- **Naming**: `YYYY-MM-DD_HH-MM_hash_description.py`
- **Utilities**: Use helpers from `superset.migrations.shared.utils` for database compatibility
- **Pattern**: Import utilities instead of raw SQLAlchemy operations

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools (symlink to this file)

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.
