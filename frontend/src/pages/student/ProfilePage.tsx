import { useEffect, useState, type FormEvent } from "react";
import { profilesApi } from "../../api/profiles";
import type { UserProfile } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Spinner, Card } from "../../components/ui";
import { TextField, TextAreaField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { formatBalance, getErrorMessage, initials, ROLE_LABELS } from "../../utils/helpers";

export function ProfilePage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ avatar: "", bio: "", phone: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    profilesApi
      .myProfile()
      .then((data) => {
        setProfile(data);
        setForm({ avatar: data.avatar ?? "", bio: data.bio ?? "", phone: data.phone ?? "" });
      })
      .catch((err) => notify(getErrorMessage(err), "error"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await profilesApi.updateMyProfile(form);
      setProfile(updated);
      notify("Профіль оновлено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !user) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl text-ink">Мій профіль</h1>

      <Card className="mt-6 flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-mono text-lg text-paper">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(user.name, user.surname)
          )}
        </div>
        <div>
          <p className="font-display text-lg text-ink">
            {user.name} {user.surname}
          </p>
          <p className="text-sm text-slate">{user.email}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gold-dark">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
        {user.role === "teacher" && (
          <div className="ml-auto text-right">
            <p className="text-xs text-slate">Баланс</p>
            <p className="font-mono text-lg font-semibold text-teal-dark">{formatBalance(user.balance)}</p>
          </div>
        )}
      </Card>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <TextField
          label="URL аватара"
          name="avatar"
          placeholder="https://…"
          value={form.avatar}
          onChange={(e) => setForm({ ...form, avatar: e.target.value })}
        />
        <TextField
          label="Телефон"
          name="phone"
          maxLength={20}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <TextAreaField
          label="Про себе"
          name="bio"
          rows={5}
          maxLength={1000}
          hint={`${form.bio.length}/1000 символів`}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <Button type="submit" isLoading={isSaving} className="self-start">
          Зберегти зміни
        </Button>
      </form>
    </div>
  );
}
