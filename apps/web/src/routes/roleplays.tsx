import type {
  RoleplayCrewTemplateId,
  RoleplayRoleDraft,
  RoleplayTemplateDetail,
  RoleplayTemplateSummary,
} from '@local/shared'
import { Link, createFileRoute } from '@tanstack/react-router'
import { startTransition, useState } from 'react'
import { ApiError, api } from '~/lib/api'
import { formatDateTime } from '~/lib/format'

export const Route = createFileRoute('/roleplays')({
  loader: async () => loadInitialRoleplayState(),
  component: RoleplaysPage,
})

type RoleplayDraft = {
  name: string
  description: string
  crewTemplateId: RoleplayCrewTemplateId
  sceneStateText: string
  roles: Array<RoleplayRoleDraft & { localId: string }>
}

function RoleplaysPage() {
  const initialData = Route.useLoaderData()
  const [templates, setTemplates] = useState<RoleplayTemplateSummary[]>(
    () => initialData.templates,
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    () => initialData.selectedTemplateId,
  )
  const [selectedTemplate, setSelectedTemplate] =
    useState<RoleplayTemplateDetail | null>(() => initialData.selectedTemplate)
  const [draft, setDraft] = useState<RoleplayDraft>(() =>
    createDraft(initialData.selectedTemplate),
  )
  const [error, setError] = useState<string | null>(() => initialData.error)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function selectTemplate(templateId: string) {
    if (templateId === selectedTemplateId || isLoadingTemplate || isSaving) {
      return
    }

    setIsLoadingTemplate(true)
    setError(null)
    try {
      const template = await api.getRoleplayTemplate(templateId)
      startTransition(() => {
        setSelectedTemplateId(template.id)
        setSelectedTemplate(template)
        setDraft(createDraft(template))
      })
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setIsLoadingTemplate(false)
    }
  }

  function createNewTemplate() {
    startTransition(() => {
      setSelectedTemplateId(null)
      setSelectedTemplate(null)
      setDraft(createDraft(null))
      setError(null)
    })
  }

  async function saveTemplate() {
    const payload = buildTemplatePayload(draft)
    if (!payload.ok) {
      setError(payload.error)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const savedTemplate = selectedTemplateId
        ? await api.updateRoleplayTemplate(selectedTemplateId, payload.value)
        : await api.createRoleplayTemplate(payload.value)
      const nextTemplates = await api.listRoleplayTemplates()
      startTransition(() => {
        setTemplates(nextTemplates)
        setSelectedTemplateId(savedTemplate.id)
        setSelectedTemplate(savedTemplate)
        setDraft(createDraft(savedTemplate))
      })
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      return
    }

    setIsDeleting(true)
    setError(null)
    try {
      await api.deleteRoleplayTemplate(selectedTemplateId)
      const nextTemplates = await api.listRoleplayTemplates()
      const nextSelectedId = nextTemplates[0]?.id ?? null
      const nextSelectedTemplate = nextSelectedId
        ? await api.getRoleplayTemplate(nextSelectedId)
        : null
      startTransition(() => {
        setTemplates(nextTemplates)
        setSelectedTemplateId(nextSelectedId)
        setSelectedTemplate(nextSelectedTemplate)
        setDraft(createDraft(nextSelectedTemplate))
      })
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="roleplays-shell">
      <aside className="roleplays-sidebar">
        <div className="roleplays-sidebar__header">
          <div>
            <p className="eyebrow">Roleplay studio</p>
            <h1>Roleplays</h1>
          </div>
          <div className="roleplays-sidebar__actions">
            <Link className="secondary-button" to="/">
              Back To Chats
            </Link>
            <button className="primary-button" onClick={createNewTemplate} type="button">
              New Template
            </button>
          </div>
        </div>

        <div className="roleplays-sidebar__list">
          {templates.length === 0 ? (
            <div className="empty-state">
              <p>No saved roleplay templates yet.</p>
            </div>
          ) : null}

          {templates.map((template) => {
            const active = template.id === selectedTemplateId
            return (
              <button
                className={`roleplay-card ${active ? 'roleplay-card--active' : ''}`}
                key={template.id}
                onClick={() => void selectTemplate(template.id)}
                type="button"
              >
                <span className="roleplay-card__title">{template.name}</span>
                <span className="roleplay-card__meta">
                  {template.crewTemplateId} · {template.roleCount} roles
                </span>
                <span className="roleplay-card__date">
                  {formatDateTime(template.updatedAt)}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="roleplays-panel">
        <header className="roleplays-panel__header">
          <div>
            <p className="eyebrow">Persistent template editor</p>
            <h2>{selectedTemplateId ? draft.name || 'Untitled template' : 'New roleplay template'}</h2>
          </div>
          <div className="roleplays-panel__actions">
            <button
              className="secondary-button"
              disabled={isDeleting || isSaving || !selectedTemplateId}
              onClick={() => void deleteTemplate()}
              type="button"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              className="primary-button"
              disabled={isSaving || isDeleting}
              onClick={() => void saveTemplate()}
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {isLoadingTemplate ? (
          <div className="runtime-banner">Loading template…</div>
        ) : null}

        <div className="roleplays-form">
          <section className="roleplays-card">
            <div className="roleplays-card__header">
              <h3>Template</h3>
              {selectedTemplate ? (
                <span className="roleplays-card__meta">
                  Updated {formatDateTime(selectedTemplate.updatedAt)}
                </span>
              ) : null}
            </div>

            <label className="roleplays-field">
              <span>Name</span>
              <input
                className="roleplays-input"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                type="text"
                value={draft.name}
              />
            </label>

            <label className="roleplays-field">
              <span>Description</span>
              <textarea
                className="roleplays-textarea roleplays-textarea--compact"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={draft.description}
              />
            </label>

            <label className="roleplays-field">
              <span>Orchestration template</span>
              <select
                className="roleplays-input"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    crewTemplateId: event.target.value as RoleplayCrewTemplateId,
                  }))
                }
                value={draft.crewTemplateId}
              >
                <option value="roleplay-fantasy">Fantasy Roleplay</option>
                <option value="roleplay-debate">Debate Roleplay</option>
              </select>
            </label>
          </section>

          <section className="roleplays-card">
            <div className="roleplays-card__header">
              <h3>Scene State</h3>
              <span className="roleplays-card__meta">Persisted as JSON in PostgreSQL</span>
            </div>
            <textarea
              className="roleplays-textarea roleplays-textarea--code"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sceneStateText: event.target.value,
                }))
              }
              spellCheck={false}
              value={draft.sceneStateText}
            />
          </section>

          <section className="roleplays-card">
            <div className="roleplays-card__header">
              <h3>Roles</h3>
              <button
                className="secondary-button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    roles: [...current.roles, createEmptyRole()],
                  }))
                }
                type="button"
              >
                Add Role
              </button>
            </div>

            <div className="roleplays-roles">
              {draft.roles.length === 0 ? (
                <p className="roleplays-card__meta">
                  No roles yet. Add at least one cast role for this template.
                </p>
              ) : null}

              {draft.roles.map((role, index) => (
                <article className="roleplays-role" key={role.localId}>
                  <div className="roleplays-role__header">
                    <h4>Role {index + 1}</h4>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          roles: current.roles.filter(
                            (candidate) => candidate.localId !== role.localId,
                          ),
                        }))
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <label className="roleplays-field">
                    <span>Role name</span>
                    <input
                      className="roleplays-input"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          roles: current.roles.map((candidate) =>
                            candidate.localId === role.localId
                              ? { ...candidate, name: event.target.value }
                              : candidate,
                          ),
                        }))
                      }
                      type="text"
                      value={role.name}
                    />
                  </label>

                  <label className="roleplays-field">
                    <span>Description</span>
                    <input
                      className="roleplays-input"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          roles: current.roles.map((candidate) =>
                            candidate.localId === role.localId
                              ? { ...candidate, description: event.target.value }
                              : candidate,
                          ),
                        }))
                      }
                      type="text"
                      value={role.description ?? ''}
                    />
                  </label>

                  <label className="roleplays-field">
                    <span>System prompt</span>
                    <textarea
                      className="roleplays-textarea"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          roles: current.roles.map((candidate) =>
                            candidate.localId === role.localId
                              ? { ...candidate, systemPrompt: event.target.value }
                              : candidate,
                          ),
                        }))
                      }
                      value={role.systemPrompt}
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

async function loadInitialRoleplayState() {
  try {
    const templates = await api.listRoleplayTemplates()
    const selectedTemplateId = templates[0]?.id ?? null
    const selectedTemplate = selectedTemplateId
      ? await api.getRoleplayTemplate(selectedTemplateId)
      : null
    return {
      templates,
      selectedTemplateId,
      selectedTemplate,
      error: null,
    }
  } catch (cause) {
    return {
      templates: [] as RoleplayTemplateSummary[],
      selectedTemplateId: null,
      selectedTemplate: null,
      error: getErrorMessage(cause),
    }
  }
}

function createDraft(template: RoleplayTemplateDetail | null): RoleplayDraft {
  if (!template) {
    return {
      name: '',
      description: '',
      crewTemplateId: 'roleplay-fantasy',
      sceneStateText: '{\n  "scene": "",\n  "tone": "",\n  "constraints": []\n}',
      roles: [createEmptyRole()],
    }
  }

  return {
    name: template.name,
    description: template.description ?? '',
    crewTemplateId: template.crewTemplateId,
    sceneStateText: JSON.stringify(template.sceneState, null, 2),
    roles: template.roles.map((role) => ({
      localId: role.id,
      id: role.id,
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
    })),
  }
}

function createEmptyRole(): RoleplayRoleDraft & { localId: string } {
  const localId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `role-${Math.random().toString(36).slice(2, 10)}`
  return {
    localId,
    name: '',
    description: '',
    systemPrompt: '',
  }
}

function buildTemplatePayload(draft: RoleplayDraft):
  | { ok: true; value: Parameters<typeof api.createRoleplayTemplate>[0] }
  | { ok: false; error: string } {
  if (!draft.name.trim()) {
    return { ok: false, error: 'Template name is required.' }
  }

  const parsedSceneState = parseSceneState(draft.sceneStateText)
  if (!parsedSceneState.ok) {
    return { ok: false, error: parsedSceneState.error }
  }

  const normalizedRoles = draft.roles.map((role) => ({
    id: role.id ?? undefined,
    name: role.name.trim(),
    description: role.description?.trim() || null,
    systemPrompt: role.systemPrompt.trim(),
  }))

  if (normalizedRoles.some((role) => !role.name || !role.systemPrompt)) {
    return {
      ok: false,
      error: 'Each role needs both a name and a system prompt.',
    }
  }

  return {
    ok: true,
    value: {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      crewTemplateId: draft.crewTemplateId,
      sceneState: parsedSceneState.value,
      roles: normalizedRoles,
    },
  }
}

function parseSceneState(sceneStateText: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(sceneStateText)
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      return {
        ok: false,
        error: 'Scene state must be a JSON object.',
      }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch (error) {
    return {
      ok: false,
      error: `Scene state JSON is invalid: ${getErrorMessage(error)}`,
    }
  }
}

function getErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    return cause.message
  }
  if (cause instanceof Error) {
    return cause.message
  }
  return 'Unknown error'
}
