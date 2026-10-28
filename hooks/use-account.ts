"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  changePassword,
  createAddress,
  deleteAddress,
  getMyAddresses,
  getMyProfile,
  setDefaultAddress,
  updateAddress,
  updateProfile,
} from "@/app/actions/account";
import { unwrap } from "@/lib/action-result";
import { query_keys } from "@/lib/query-keys";
import type { AddressInput, ChangePasswordInput, ProfileInput, UpdateAddressInput } from "@/lib/schemas/account";

export function useMyProfile() {
  return useQuery({ queryKey: query_keys.my_profile, queryFn: async () => unwrap(await getMyProfile()) });
}

export function useUpdateProfile() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => unwrap(await updateProfile(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.my_profile }),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: async (input: ChangePasswordInput) => unwrap(await changePassword(input)) });
}

export function useMyAddresses() {
  return useQuery({ queryKey: query_keys.my_addresses, queryFn: async () => unwrap(await getMyAddresses()) });
}

function useInvalidateAddresses() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.my_addresses });
}

export function useCreateAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: async (input: AddressInput) => unwrap(await createAddress(input)),
    onSuccess: invalidate,
  });
}

export function useUpdateAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: async (input: UpdateAddressInput) => unwrap(await updateAddress(input)),
    onSuccess: invalidate,
  });
}

export function useSetDefaultAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await setDefaultAddress(id)),
    onSuccess: invalidate,
  });
}

export function useDeleteAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteAddress(id)),
    onSuccess: invalidate,
  });
}
