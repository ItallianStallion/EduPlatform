import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { profilesApi } from "../../api/profiles";
import type { UserProfile } from "../../types";
import { Spinner, Card, EmptyState } from "../../components/ui";
import { getErrorMessage } from "../../utils/helpers";

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    profilesApi
      .publicProfile(id)
      .then(setProfile)
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  if (error) return <EmptyState title="Профіль не знайдено" description={error} />;
  if (!profile) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Card className="flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/10">
          {profile.avatar && <img src={profile.avatar} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="font-display text-lg text-ink">Профіль викладача</p>
          {profile.phone && <p className="text-sm text-slate">{profile.phone}</p>}
        </div>
      </Card>
      {profile.bio && (
        <Card className="mt-4 p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{profile.bio}</p>
        </Card>
      )}
    </div>
  );
}
