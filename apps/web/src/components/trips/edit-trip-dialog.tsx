"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";

interface EditStop {
  place_id?: string;
  slug: string;
  label: string;
  suggested_time_min: number;
  notes: string;
}

interface Trip {
  id: string;
  title: string;
  stops: Array<{
    id: string;
    place_id?: string;
    place?: { id?: string; name: string };
    name?: string;
    slug?: string;
    suggested_time_min?: number;
    suggestedDurationMin?: number;
    notes?: string;
  }>;
}

interface EditTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  trip: Trip | null;
  serverUrl?: string;
  sessionToken?: string;
}

export function EditTripDialog({
  isOpen,
  onClose,
  onSuccess,
  trip,
  serverUrl = "http://localhost:3000",
  sessionToken = "",
}: EditTripDialogProps) {
  const { t } = useTranslation();
  const [editTitle, setEditTitle] = useState("");
  const [editStops, setEditStops] = useState<EditStop[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when trip changes
  useEffect(() => {
    if (trip) {
      setEditTitle(trip.title);
      setEditStops(
        trip.stops.map((s: any) => ({
          place_id: s?.place_id ?? s?.placeId ?? s?.place?.id,
          slug: s?.slug ?? "",
          label: s?.place?.name ?? s?.name ?? s?.slug ?? "",
          suggested_time_min: s?.suggested_time_min ?? s?.suggestedDurationMin ?? 60,
          notes: s?.notes ?? "",
        }))
      );
    }
  }, [trip, isOpen]);

  const handleSaveEdit = async () => {
    if (!trip || !sessionToken) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${trip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: editTitle,
          stops: editStops.map((stop) => ({
            ...(stop.place_id ? { place_id: stop.place_id } : { slug: stop.slug }),
            suggested_time_min: stop.suggested_time_min,
            notes: stop.notes,
          })),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const json = contentType.includes("application/json")
        ? await res.json()
        : { success: false, error: await res.text() || t("trips.badResponse") };

      if (!res.ok || !json.success) {
        throw new Error(json.error || t("trips.updateFailed"));
      }

      toast.success(t("trips.updated"));
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(t("trips.updateFailedWith", { message: e?.message || t("trips.unknownError") }));
    } finally {
      setIsSaving(false);
    }
  };

  const updateStopTime = (index: number, value: number) => {
    const updated = [...editStops];
    updated[index].suggested_time_min = value;
    setEditStops(updated);
  };

  const updateStopNotes = (index: number, value: string) => {
    const updated = [...editStops];
    updated[index].notes = value;
    setEditStops(updated);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const updated = [...editStops];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setEditStops(updated);
  };

  const moveStopDown = (index: number) => {
    if (index === editStops.length - 1) return;
    const updated = [...editStops];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setEditStops(updated);
  };

  const removeStop = (index: number) => {
    const updated = editStops.filter((_, i) => i !== index);
    setEditStops(updated);
  };

  if (!isOpen || !trip) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label={t("trips.editTitle")} className="bg-card rounded-2xl shadow-card-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto text-foreground">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="font-display text-2xl font-semibold text-foreground">{t("trips.editTitle")}</h2>
            <button
              onClick={onClose}
              aria-label={t("trips.close")}
              className="p-1 hover:bg-secondary rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              {t("trips.tripTitle")}
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("trips.editTitlePlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              {t("trips.stops")}
            </label>
            <div className="space-y-3">
              {editStops.map((stop, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 border rounded-md bg-muted"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-black">{stop.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          {t("trips.suggestedTime")}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={stop.suggested_time_min}
                          onChange={(e) =>
                            updateStopTime(
                              index,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{t("trips.notes")}</label>
                        <input
                          type="text"
                          value={stop.notes}
                          onChange={(e) => updateStopNotes(index, e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder={t("trips.notesPlaceholder")}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveStopUp(index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t("trips.moveUp")}
                      aria-label={t("trips.moveUp")}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStopDown(index)}
                      disabled={index === editStops.length - 1}
                      className="p-1 hover:bg-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t("trips.moveDown")}
                      aria-label={t("trips.moveDown")}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStop(index)}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded"
                      title={t("trips.removeStop")}
                      aria-label={t("trips.removeStop")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("trips.cancel")}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("trips.saving")}
                </>
              ) : (
                t("trips.saveChanges")
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
