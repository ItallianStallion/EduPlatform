import { useEffect, useState } from "react";
import { Eye, Search, ShieldBan, ShieldCheck, UserCog } from "lucide-react";
import { adminApi } from "../../api/admin";
import { profilesApi } from "../../api/profiles";
import type { AdminUserListItem, UserProfile, UserRole } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Pagination } from "../../components/Pagination";
import { ConfirmDialog, Modal } from "../../components/Modal";
import { SelectField } from "../../components/FormField";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatDate, getErrorMessage, initials, ROLE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

export function AdminUsersPage() {
  const { notify } = useToast();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<{ items: AdminUserListItem[]; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserListItem | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUserListItem | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<AdminUserListItem | null>(null);
  const [detailsProfile, setDetailsProfile] = useState<UserProfile | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("student");
  const [isActing, setIsActing] = useState(false);

  // Список користувачів не повертає вкладений profile (avatar/phone/bio) —
  // підвантажуємо його окремо тим самим ендпоінтом, що й публічний профіль.
  useEffect(() => {
    if (!detailsTarget) {
      setDetailsProfile(null);
      return;
    }
    let cancelled = false;
    setIsDetailsLoading(true);
    profilesApi
      .publicProfile(detailsTarget.id)
      .then((profile) => !cancelled && setDetailsProfile(profile))
      .catch(() => !cancelled && setDetailsProfile(null))
      .finally(() => !cancelled && setIsDetailsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [detailsTarget]);

  function reload() {
    setIsLoading(true);
    adminApi
      .listUsers({ q: debouncedSearch || undefined, role: roleFilter || undefined, page, limit: 15 })
      .then((data) => setResult({ items: data.items, totalPages: data.totalPages }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  useEffect(reload, [debouncedSearch, roleFilter, page]);

  async function handleBanToggle() {
    if (!banTarget) return;
    setIsActing(true);
    try {
      if (banTarget.isBanned) {
        await adminApi.unbanUser(banTarget.id);
        notify("Користувача розблоковано", "success");
      } else {
        await adminApi.banUser(banTarget.id);
        notify("Користувача заблоковано", "success");
      }
      setBanTarget(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsActing(false);
    }
  }

  async function handleRoleChange() {
    if (!roleTarget) return;
    setIsActing(true);
    try {
      await adminApi.changeRole(roleTarget.id, newRole);
      notify("Роль змінено", "success");
      setRoleTarget(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Користувачі</h1>
      <p className="mt-1 text-sm text-slate">Пошук, зміна ролей, бан і розбан користувачів.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за email або іменем…"
            className="w-full rounded-md border border-line bg-paper-raised py-2.5 pl-9 pr-3 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
          className="rounded-md border border-line bg-paper-raised px-3 py-2.5 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
        >
          <option value="">Усі ролі</option>
          <option value="student">Студенти</option>
          <option value="teacher">Викладачі</option>
          <option value="admin">Адміни</option>
        </select>
      </div>

      {isLoading && <Spinner />}
      {!isLoading && error && <EmptyState title="Не вдалося завантажити користувачів" description={error} />}
      {!isLoading && !error && result && result.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Користувачів не знайдено" />
        </div>
      )}

      {!isLoading && !error && result && result.items.length > 0 && (
        <>
          <div className="mt-6 overflow-hidden rounded-lg border border-line bg-paper-raised">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Ім'я</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {u.name} {u.surname}
                    </td>
                    <td className="px-4 py-3 text-slate">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned ? <Badge tone="coral">Заблокований</Badge> : <Badge tone="teal">Активний</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailsTarget(u)}>
                          <Eye className="h-3.5 w-3.5" /> Деталі
                        </Button>
                        {u.role !== "admin" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRoleTarget(u);
                              setNewRole(u.role);
                            }}
                          >
                            <UserCog className="h-3.5 w-3.5" /> Роль
                          </Button>
                        )}
                        {u.role !== "admin" && (
                          <Button
                            size="sm"
                            variant={u.isBanned ? "teal" : "danger"}
                            onClick={() => setBanTarget(u)}
                            disabled={u.id === currentUser?.id}
                          >
                            {u.isBanned ? (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" /> Розбанити
                              </>
                            ) : (
                              <>
                                <ShieldBan className="h-3.5 w-3.5" /> Бан
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <Pagination page={page} totalPages={result.totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        isOpen={!!banTarget}
        title={banTarget?.isBanned ? "Розблокувати користувача?" : "Заблокувати користувача?"}
        description={`${banTarget?.name} ${banTarget?.surname} (${banTarget?.email})`}
        confirmLabel={banTarget?.isBanned ? "Розблокувати" : "Заблокувати"}
        isDanger={!banTarget?.isBanned}
        isLoading={isActing}
        onConfirm={handleBanToggle}
        onCancel={() => setBanTarget(null)}
      />

      <Modal isOpen={!!roleTarget} onClose={() => setRoleTarget(null)} title="Змінити роль">
        <p className="mb-4 text-sm text-slate">
          {roleTarget?.name} {roleTarget?.surname} ({roleTarget?.email})
        </p>
        <SelectField label="Нова роль" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
          <option value="student">Студент</option>
          <option value="teacher">Викладач</option>
          <option value="admin">Адміністратор</option>
        </SelectField>
        <Button className="mt-4 w-full" onClick={handleRoleChange} isLoading={isActing}>
          Зберегти
        </Button>
      </Modal>

      <Modal isOpen={!!detailsTarget} onClose={() => setDetailsTarget(null)} title="Деталі користувача">
        {detailsTarget && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/10 font-display text-sm text-ink">
                {detailsProfile?.avatar ? (
                  <img
                    src={detailsProfile.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(detailsTarget.name, detailsTarget.surname)
                )}
              </div>
              <div>
                <p className="font-display text-base text-ink">
                  {detailsTarget.name} {detailsTarget.surname}
                </p>
                <p className="text-sm text-slate">{detailsTarget.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-paper p-3 text-sm">
              <div>
                <p className="text-xs text-slate">Роль</p>
                <p className="mt-0.5 font-medium text-ink">{ROLE_LABELS[detailsTarget.role]}</p>
              </div>
              <div>
                <p className="text-xs text-slate">Статус</p>
                <p className="mt-0.5">
                  {detailsTarget.isBanned ? (
                    <Badge tone="coral">Заблокований</Badge>
                  ) : (
                    <Badge tone="teal">Активний</Badge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate">Баланс</p>
                <p className="mt-0.5 font-mono font-medium text-ink">{detailsTarget.balance} ₴</p>
              </div>
              <div>
                <p className="text-xs text-slate">Телефон</p>
                <p className="mt-0.5 text-ink">
                  {isDetailsLoading ? "Завантаження…" : detailsProfile?.phone || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate">Дата реєстрації</p>
                <p className="mt-0.5 text-ink">{formatDate(detailsTarget.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate">Останнє оновлення</p>
                <p className="mt-0.5 text-ink">{formatDate(detailsTarget.updatedAt)}</p>
              </div>
              {!!detailsTarget.failedLoginAttempts && (
                <div>
                  <p className="text-xs text-slate">Невдалі спроби входу</p>
                  <p className="mt-0.5 text-ink">{detailsTarget.failedLoginAttempts}</p>
                </div>
              )}
              {detailsTarget.lockedUntil && (
                <div>
                  <p className="text-xs text-slate">Заблоковано до</p>
                  <p className="mt-0.5 text-ink">{formatDate(detailsTarget.lockedUntil)}</p>
                </div>
              )}
            </div>

            {isDetailsLoading ? (
              <div className="flex justify-center py-2">
                <Spinner />
              </div>
            ) : (
              detailsProfile?.bio && (
                <div>
                  <p className="mb-1 text-xs text-slate">Про себе</p>
                  <p className="whitespace-pre-line text-sm text-ink/90">{detailsProfile.bio}</p>
                </div>
              )
            )}

            <div className="flex justify-end gap-2 pt-2">
              {detailsTarget.role !== "admin" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRoleTarget(detailsTarget);
                    setNewRole(detailsTarget.role);
                    setDetailsTarget(null);
                  }}
                >
                  <UserCog className="h-3.5 w-3.5" /> Змінити роль
                </Button>
              )}
              {detailsTarget.role !== "admin" && (
                <Button
                  size="sm"
                  variant={detailsTarget.isBanned ? "teal" : "danger"}
                  onClick={() => {
                    setBanTarget(detailsTarget);
                    setDetailsTarget(null);
                  }}
                >
                  {detailsTarget.isBanned ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> Розбанити
                    </>
                  ) : (
                    <>
                      <ShieldBan className="h-3.5 w-3.5" /> Бан
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
