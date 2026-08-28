"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form
      action={formAction}
      className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/80 p-6"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white">Ekran Paneli</h1>
        <p className="text-sm text-zinc-500">Devam etmek için şifreyi girin.</p>
      </div>

      <input
        type="password"
        name="sifre"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Şifre"
        className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500"
      />

      {state.error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-sky-600 px-3 py-2 font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "Kontrol ediliyor…" : "Giriş"}
      </button>
    </form>
  );
}
