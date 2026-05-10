import type {
  RoleplayCrewTemplateId,
  RoleplayRoleDraft,
  RoleplayTemplateDetail,
  RoleplayTemplateSummary,
} from '@local/shared'
import { Link, createFileRoute } from '@tanstack/react-router'
import { startTransition, useState } from 'react'
import { ApiError, api } from '~/lib/api'
import { cn } from '~/lib/cn'
import { formatDateTime } from '~/lib/format'
import {
  btnPrimary,
  btnSecondary,
  elevatedShell,
  eyebrow as eyebrowClass,
} from '~/styles/ui'

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

  const fieldClass = 'flex flex-col gap-[0.45rem]'
  const inputClass =
    'w-full rounded-[18px] border border-[color:var(--border)] bg-[rgba(11,16,26,0.74)] px-[0.9rem] py-[0.8rem] text-[var(--text)]'
  const textareaClass = cn(inputClass, 'min-h-[120px] resize-y')
  const textareaCompactClass = cn(inputClass, 'min-h-[88px] resize-y')
  const textareaCodeClass = cn(
    inputClass,
    'min-h-[220px] resize-y font-[Consolas,Courier_New,monospace]',
  )
  const cardShell =
    'rounded-[24px] border border-[color:var(--border)] bg-[var(--bg-panel)] p-4'

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 min-[981px]:grid-cols-[320px_minmax(0,1fr)]">
      <aside
        className={cn(
          elevatedShell,
          'flex flex-col gap-4 rounded-[28px] p-5 supports-[backdrop-filter]:backdrop-blur-[22px]',
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={eyebrowClass}>Roleplay studio</p>
              <h1>Roleplays</h1>
            </div>
            <div className="flex flex-col gap-2 sm:items-stretch">
              <Link className={cn(btnSecondary, 'justify-center')} to="/">
                Back To Chats
              </Link>
              <button
                className={cn(btnPrimary, 'justify-center')}
                onClick={createNewTemplate}
                type="button"
              >
                New Template
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-[0.85rem] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="grid min-h-[200px] place-items-center text-center text-[var(--text-muted)]">
              <p>No saved roleplay templates yet.</p>
            </div>
          ) : null}

          {templates.map((template) => {
            const active = template.id === selectedTemplateId
            return (
              <button
                className={cn(
                  'flex w-full flex-col gap-[0.3rem] rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-panel)] px-4 py-[0.9rem] text-left text-inherit',
                  active &&
                    'border-[var(--accent-strong)] bg-gradient-to-br from-[rgba(126,215,193,0.18)] to-[rgba(23,31,46,0.95)]',
                )}
                key={template.id}
                onClick={() => void selectTemplate(template.id)}
                type="button"
              >
                <span className="font-semibold">{template.name}</span>
                <span className="text-[0.84rem] text-[var(--text-muted)]">
                  {template.crewTemplateId} · {template.roleCount} roles
                </span>
                <span className="text-[0.84rem] text-[var(--text-muted)]">
                  {formatDateTime(template.updatedAt)}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section
        className={cn(
          elevatedShell,
          'flex min-h-0 flex-col gap-4 rounded-[32px] p-5 supports-[backdrop-filter]:backdrop-blur-[22px]',
        )}
      >
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={eyebrowClass}>Persistent template editor</p>
            <h2>
              {selectedTemplateId
                ? draft.name || 'Untitled template'
                : 'New roleplay template'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className={btnSecondary}
              disabled={isDeleting || isSaving || !selectedTemplateId}
              onClick={() => void deleteTemplate()}
              type="button"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              className={btnPrimary}
              disabled={isSaving || isDeleting}
              onClick={() => void saveTemplate()}
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.4)] px-4 py-[0.95rem] text-[#ffd4d4]">
            {error}
          </div>
        ) : null}
        {isLoadingTemplate ? (
          <div className="rounded-[10px] border border-[rgba(255,201,107,0.28)] bg-[rgba(83,57,19,0.34)] px-4 py-[0.95rem] text-[#ffe6b3]">
            Loading template…
          </div>
        ) : null}

        <div className="flex min-h-0 flex-col gap-[0.85rem] overflow-y-auto">
          <section className={cn(cardShell, 'flex flex-col gap-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0">Template</h3>
              {selectedTemplate ? (
                <span className="text-[0.84rem] text-[var(--text-muted)]">
                  Updated {formatDateTime(selectedTemplate.updatedAt)}
                </span>
              ) : null}
            </div>

            <label className={fieldClass}>
              <span className="font-semibold">Name</span>
              <input
                className={inputClass}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                type="text"
                value={draft.name}
              />
            </label>

            <label className={fieldClass}>
              <span className="font-semibold">Description</span>
              <textarea
                className={textareaCompactClass}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={draft.description}
              />
            </label>

            <label className={fieldClass}>
              <span className="font-semibold">Orchestration template</span>
              <select
                className={inputClass}
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

          <section className={cn(cardShell, 'flex flex-col gap-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0">Scene State</h3>
              <span className="text-[0.84rem] text-[var(--text-muted)]">
                Persisted as JSON in PostgreSQL
              </span>
            </div>
            <textarea
              className={textareaCodeClass}
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

          <section className={cn(cardShell, 'flex flex-col gap-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0">Roles</h3>
              <button
                className={btnSecondary}
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

            <div className="flex flex-col gap-[0.85rem]">
              {draft.roles.length === 0 ? (
                <p className="m-0 text-[0.84rem] text-[var(--text-muted)]">
                  No roles yet. Add at least one cast role for this template.
                </p>
              ) : null}

              {draft.roles.map((role, index) => (
                <article className={cardShell} key={role.localId}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h4 className="m-0">Role {index + 1}</h4>
                    <button
                      className={btnSecondary}
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

                  <div className="flex flex-col gap-4">
                    <label className={fieldClass}>
                      <span className="font-semibold">Role name</span>
                      <input
                        className={inputClass}
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

                    <label className={fieldClass}>
                      <span className="font-semibold">Description</span>
                      <input
                        className={inputClass}
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

                    <label className={fieldClass}>
                      <span className="font-semibold">System prompt</span>
                      <textarea
                        className={textareaClass}
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
                  </div>
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
