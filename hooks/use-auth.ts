"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmPasswordReset, requestPasswordReset, signIn, signOut, signUp } from "@/app/actions/auth";
import { unwrap } from "@/lib/action-result";
import type {
  ConfirmPasswordResetInput,
  RequestPasswordResetInput,
  SignInInput,
  SignUpInput,
} from "@/lib/schemas/auth";

export function useSignIn() {
  return useMutation({ mutationFn: async (input: SignInInput) => unwrap(await signIn(input)) });
}

export function useSignUp() {
  return useMutation({ mutationFn: async (input: SignUpInput) => unwrap(await signUp(input)) });
}

export function useSignOut() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await signOut()),
    // Nothing cached for the previous user may survive sign-out.
    onSuccess: () => query_client.clear(),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (input: RequestPasswordResetInput) => unwrap(await requestPasswordReset(input)),
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (input: ConfirmPasswordResetInput) => unwrap(await confirmPasswordReset(input)),
  });
}
