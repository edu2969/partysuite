"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { GrGroup } from "react-icons/gr";
import { FaPlus, FaUserPen, FaTrash, FaRotateLeft, FaStar } from "react-icons/fa6";
import { MdOutlineSelfImprovement } from "react-icons/md";

import DeleteAccountModal from "../modals/DeleteAccountModal";
import Loader from "../prefabs/Loader";

// =========================
// TYPES
// =========================

type Role = "ADMINISTRADOR" | "PORTERIA" | "NEO" | "ELIMINADO" | "LISTERO" | "LISTERO_PRO";

interface Account {
  _id: string;
  email: string;
  name: string;
  role: Role;
}

interface AccountsResponse {
  accounts: Account[];
  page: number;
  hasMore: boolean;
}

// =========================
// API
// =========================

const PAGE_SIZE = 10;

async function fetchAccounts({
  deleted,
  filter,
  pageParam,
}: {
  deleted: boolean;
  filter: string;
  pageParam: number;
}): Promise<AccountsResponse> {
  const params = new URLSearchParams({
    q: filter,
    page: String(pageParam),
    pageSize: String(PAGE_SIZE),
    ...(deleted ? { deleted: "true" } : {}),
  });

  const res = await fetch(`/api/accounts?${params}`);
  if (!res.ok) throw new Error("Error al cargar cuentas");
  return res.json();
}

async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar cuenta");
}

// =========================
// COMPONENT
// =========================

export default function AccountsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "ADMINISTRADOR";

  const [showDeleted, setShowDeleted] = useState(false);
  const [text, setText] = useState("");
  const debouncedText = useDebounce(text, 200);
  const isSearching = text !== debouncedText;

  const [deleteModal, setDeleteModal] = useState<{ id: string | null; name?: string }>({
    id: null,
  });

  // =========================
  // QUERY
  // =========================

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["accounts", showDeleted, debouncedText],
    queryFn: ({ pageParam }) =>
      fetchAccounts({ deleted: showDeleted, filter: debouncedText, pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const accounts = useMemo(
    () => data?.pages.flatMap((p) => p.accounts) ?? [],
    [data]
  );

  // =========================
  // MUTATION
  // =========================

  const { mutate: handleDelete, isPending } = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setDeleteModal({ id: null });
    },
  });

  // =========================
  // SENTINEL
  // =========================

  const sentinelCallback = (node: HTMLDivElement | null) => {
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  };

  // =========================
  // RENDER
  // =========================

  return (
    <main className="w-full h-screen overflow-y-scroll">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex flex-col items-end space-y-3 mb-8 w-full md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-3">
          <h1 className="flex gap-3 text-3xl font-bold text-white text-nowrap">
            <span className="text-cyan-400">
              <GrGroup size={36} />
            </span>
            Cuentas
          </h1>

          {isAdmin && (
            <button
              onClick={() => router.push("/accounts/")}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center gap-2 text-xl"
            >
              <FaPlus />
              Nueva cuenta
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Tab
            text="Eliminados"
            active={showDeleted}
            onClick={() => setShowDeleted((prev) => !prev)}
          />
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="mb-2 block text-sm text-gray-300">
            Búsqueda por nombre o email
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-500"
          />
          <div className="mt-2 h-5 text-sm text-gray-400">
            {isSearching && "Buscando..."}
          </div>
        </div>

        {/* States */}
        {isLoading && <Loader text="Cargando usuarios..." />}

        {!isLoading && accounts.length === 0 && (
          <EmptyState text={text} showDeleted={showDeleted} />
        )}

        {/* List */}
        {!isLoading && accounts.length > 0 && (
          <>
            <div className="w-full space-y-5">
              {accounts.map((account, index) => (
                <AccountCard
                  key={account._id}
                  account={account}
                  index={index}
                  isAdmin={isAdmin}
                  showDeleted={showDeleted}
                  onEdit={() => router.push(`/accounts/${account._id}`)}
                  onDelete={() => setDeleteModal({ id: account._id, name: account.name })}
                />
              ))}
            </div>

            <div ref={sentinelCallback} className="h-px" />

            {isFetchingNextPage && (
              <div className="py-6 text-center text-sm text-gray-400">
                Cargando más...
              </div>
            )}

            {!hasNextPage && !isFetchingNextPage && (
              <div className="py-6 text-center text-sm text-gray-600">
                No hay más resultados
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <DeleteAccountModal
        show={deleteModal.id !== null}
        onClose={() => setDeleteModal({ id: null })}
        isPending={isPending}
        onConfirm={() => deleteModal.id && handleDelete(deleteModal.id)}
        deleteAccount={!showDeleted}
        userName={deleteModal.name ?? ""}
      />
    </main>
  );
}

// =========================
// ACCOUNT CARD
// =========================

interface AccountCardProps {
  account: Account;
  index: number;
  isAdmin: boolean;
  showDeleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function AccountCard({ account, index, isAdmin, showDeleted, onEdit, onDelete }: AccountCardProps) {
  return (
    <div className="w-full rounded-xl bg-white/5 border border-cyan-400/20 p-5 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-0">

        {/* Info */}
        <div>
          <div className="flex items-center gap-1 text-2xl text-gray-400">
            <span className="mt-1 mr-2">{index + 1}.</span>
            <span className="text-3xl font-semibold text-white">{account.name}</span>
            <RoleBadge role={account.role} />
          </div>
          <div className="text-cyan-200">{account.email}</div>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="flex items-end justify-end gap-2 self-end md:self-auto">
            <button
              onClick={onEdit}
              className="w-22 text-center border-2 rounded-2xl border-blue-400 p-4 hover:bg-blue-900"
            >
              <FaUserPen size={32} className="text-blue-500 mx-auto" />
              <span>Editar</span>
            </button>

            <button
              onClick={onDelete}
              className="w-28 text-center border-2 rounded-2xl border-green-400 p-4"
            >
              {showDeleted
                ? <><FaRotateLeft size={32} className="mx-auto" /><span>Reintegrar</span></>
                : <><FaTrash size={32} className="text-red-600 mx-auto" /><span>Eliminar</span></>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================
// ROLE BADGE
// =========================

function RoleBadge({ role }: { role: Role }) {
  if (role === "ADMINISTRADOR") return <FaStar className="text-yellow-400" />;
  if (role === "LISTERO_PRO") return (
    <>
      <MdOutlineSelfImprovement size={34} className="text-yellow-400" />
      <span className="text-xs text-yellow-400">PRO</span>
    </>
  );
  return null;
}

// =========================
// EMPTY STATE
// =========================

function EmptyState({ text, showDeleted }: { text: string; showDeleted: boolean }) {
  const message = text
    ? "No hay coincidencias"
    : showDeleted
    ? "No hay cuentas eliminadas"
    : "No hay usuarios registrados";

  return (
    <div className="rounded-xl bg-white/5 p-6 text-center text-gray-400">
      {message}
    </div>
  );
}

// =========================
// TAB
// =========================

function Tab({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-lg transition ${
        active ? "bg-cyan-500 text-black font-semibold" : "bg-white/10 text-gray-300 hover:bg-white/20"
      }`}
    >
      {text}
    </button>
  );
}