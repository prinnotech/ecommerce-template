/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	ActivityLog: "activity_log",
	Addresses: "addresses",
	Categories: "categories",
	CheckoutSessions: "checkout_sessions",
	ContactMessages: "contact_messages",
	DiscountCodes: "discount_codes",
	OrderEvents: "order_events",
	OrderItems: "order_items",
	Orders: "orders",
	Payments: "payments",
	ProductVariants: "product_variants",
	Products: "products",
	Roles: "roles",
	SiteSettings: "site_settings",
	TeamMembers: "team_members",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type ActivityLogRecord<Tdetails = unknown> = {
	action: string
	actor?: RecordIdString
	created_at: IsoAutoDateString
	details?: null | Tdetails
	id: string
	is_denied?: boolean
	target_id?: string
	target_type?: string
	updated_at: IsoAutoDateString
}

export type AddressesRecord = {
	city: string
	country: string
	created_at: IsoAutoDateString
	full_name: string
	id: string
	is_default?: boolean
	line1: string
	line2?: string
	phone?: string
	postal_code?: string
	region?: string
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type CategoriesRecord<Tdescription = unknown, Tname = unknown> = {
	created_at: IsoAutoDateString
	description?: null | Tdescription
	id: string
	image?: FileNameString
	is_active?: boolean
	name: null | Tname
	parent?: RecordIdString
	slug: string
	sort_order?: number
	updated_at: IsoAutoDateString
}

export const CheckoutSessionsPaymentMethodOptions = {
	"card": "card",
	"cash_on_delivery": "cash_on_delivery",
} as const
export type CheckoutSessionsPaymentMethodOptions = typeof CheckoutSessionsPaymentMethodOptions[keyof typeof CheckoutSessionsPaymentMethodOptions]

export const CheckoutSessionsStatusOptions = {
	"open": "open",
	"completed": "completed",
	"expired": "expired",
	"failed": "failed",
} as const
export type CheckoutSessionsStatusOptions = typeof CheckoutSessionsStatusOptions[keyof typeof CheckoutSessionsStatusOptions]
export type CheckoutSessionsRecord<Tattribution = unknown, Tbilling_address = unknown, Tline_items = unknown, Tshipping_address = unknown> = {
	attribution?: null | Tattribution
	billing_address?: null | Tbilling_address
	cod_fee?: number
	created_at: IsoAutoDateString
	currency?: string
	discount_code?: RecordIdString
	discount_total?: number
	email?: string
	expires_at?: IsoDateString
	id: string
	line_items?: null | Tline_items
	locale?: string
	payment_method?: CheckoutSessionsPaymentMethodOptions
	phone?: string
	shipping_address?: null | Tshipping_address
	shipping_method?: string
	shipping_total?: number
	status: CheckoutSessionsStatusOptions
	subtotal?: number
	tax_total?: number
	total?: number
	updated_at: IsoAutoDateString
	user?: RecordIdString
}

export const ContactMessagesStatusOptions = {
	"new": "new",
	"read": "read",
	"archived": "archived",
} as const
export type ContactMessagesStatusOptions = typeof ContactMessagesStatusOptions[keyof typeof ContactMessagesStatusOptions]
export type ContactMessagesRecord = {
	created_at: IsoAutoDateString
	email: string
	id: string
	message: string
	name: string
	phone?: string
	status: ContactMessagesStatusOptions
	subject?: string
	updated_at: IsoAutoDateString
}

export const DiscountCodesTypeOptions = {
	"percent": "percent",
	"fixed": "fixed",
} as const
export type DiscountCodesTypeOptions = typeof DiscountCodesTypeOptions[keyof typeof DiscountCodesTypeOptions]
export type DiscountCodesRecord = {
	code: string
	created_at: IsoAutoDateString
	ends_at?: IsoDateString
	id: string
	is_active?: boolean
	min_subtotal?: number
	starts_at?: IsoDateString
	type: DiscountCodesTypeOptions
	updated_at: IsoAutoDateString
	usage_limit?: number
	used_count?: number
	value?: number
}

export const OrderEventsTypeOptions = {
	"created": "created",
	"status_changed": "status_changed",
	"payment_status_changed": "payment_status_changed",
	"note": "note",
	"shipped": "shipped",
	"email_sent": "email_sent",
} as const
export type OrderEventsTypeOptions = typeof OrderEventsTypeOptions[keyof typeof OrderEventsTypeOptions]
export type OrderEventsRecord = {
	actor?: RecordIdString
	created_at: IsoAutoDateString
	from_status?: string
	id: string
	is_customer_visible?: boolean
	message?: string
	order: RecordIdString
	to_status?: string
	type: OrderEventsTypeOptions
	updated_at: IsoAutoDateString
}

export type OrderItemsRecord = {
	created_at: IsoAutoDateString
	id: string
	image?: string
	line_total?: number
	order: RecordIdString
	product?: RecordIdString
	quantity?: number
	sku?: string
	title: string
	unit_price?: number
	updated_at: IsoAutoDateString
	variant?: RecordIdString
	variant_label?: string
}

export const OrdersStatusOptions = {
	"pending": "pending",
	"paid": "paid",
	"processing": "processing",
	"shipped": "shipped",
	"delivered": "delivered",
	"cancelled": "cancelled",
	"refunded": "refunded",
} as const
export type OrdersStatusOptions = typeof OrdersStatusOptions[keyof typeof OrdersStatusOptions]

export const OrdersPaymentStatusOptions = {
	"unpaid": "unpaid",
	"paid": "paid",
	"failed": "failed",
	"refunded": "refunded",
} as const
export type OrdersPaymentStatusOptions = typeof OrdersPaymentStatusOptions[keyof typeof OrdersPaymentStatusOptions]

export const OrdersPaymentMethodOptions = {
	"card": "card",
	"cash_on_delivery": "cash_on_delivery",
} as const
export type OrdersPaymentMethodOptions = typeof OrdersPaymentMethodOptions[keyof typeof OrdersPaymentMethodOptions]
export type OrdersRecord<Tattribution = unknown, Tbilling_address = unknown, Tshipping_address = unknown> = {
	attribution?: null | Tattribution
	billing_address?: null | Tbilling_address
	cancelled_at?: IsoDateString
	carrier?: string
	checkout_session?: RecordIdString
	cod_fee?: number
	created_at: IsoAutoDateString
	currency?: string
	customer_note?: string
	deleted_at?: IsoDateString
	delivered_at?: IsoDateString
	discount_code?: RecordIdString
	discount_total?: number
	email: string
	id: string
	internal_note?: string
	locale?: string
	order_number?: number
	paid_at?: IsoDateString
	payment_method?: OrdersPaymentMethodOptions
	payment_status: OrdersPaymentStatusOptions
	phone?: string
	shipped_at?: IsoDateString
	shipping_address?: null | Tshipping_address
	shipping_method?: string
	shipping_total?: number
	status: OrdersStatusOptions
	subtotal?: number
	tax_total?: number
	total?: number
	tracking_number?: string
	tracking_url?: string
	updated_at: IsoAutoDateString
	user?: RecordIdString
}

export const PaymentsProviderOptions = {
	"card": "card",
	"cash_on_delivery": "cash_on_delivery",
	"stripe": "stripe",
} as const
export type PaymentsProviderOptions = typeof PaymentsProviderOptions[keyof typeof PaymentsProviderOptions]

export const PaymentsStatusOptions = {
	"pending": "pending",
	"succeeded": "succeeded",
	"failed": "failed",
	"refunded": "refunded",
} as const
export type PaymentsStatusOptions = typeof PaymentsStatusOptions[keyof typeof PaymentsStatusOptions]
export type PaymentsRecord<Traw = unknown> = {
	amount?: number
	checkout_session?: RecordIdString
	created_at: IsoAutoDateString
	currency?: string
	error_code?: string
	id: string
	order?: RecordIdString
	provider: PaymentsProviderOptions
	provider_ref?: string
	raw?: null | Traw
	status: PaymentsStatusOptions
	updated_at: IsoAutoDateString
}

export type ProductVariantsRecord = {
	color?: string
	color_hex?: string
	created_at: IsoAutoDateString
	id: string
	is_active?: boolean
	price_override?: number
	product: RecordIdString
	size?: string
	sku?: string
	sort_order?: number
	stock?: number
	updated_at: IsoAutoDateString
}

export const ProductsStatusOptions = {
	"draft": "draft",
	"active": "active",
	"archived": "archived",
} as const
export type ProductsStatusOptions = typeof ProductsStatusOptions[keyof typeof ProductsStatusOptions]
export type ProductsRecord<Tdescription = unknown, Ttags = unknown, Ttitle = unknown> = {
	category?: RecordIdString
	compare_at_price?: number
	created_at: IsoAutoDateString
	deleted_at?: IsoDateString
	description?: null | Tdescription
	id: string
	images?: FileNameString[]
	is_featured?: boolean
	price?: number
	slug: string
	status: ProductsStatusOptions
	tags?: null | Ttags
	title: null | Ttitle
	updated_at: IsoAutoDateString
}

export type RolesRecord<Tpermissions = unknown> = {
	created_at: IsoAutoDateString
	description?: string
	id: string
	is_system?: boolean
	name: string
	permissions?: null | Tpermissions
	updated_at: IsoAutoDateString
}

export type SiteSettingsRecord<Tvalue = unknown> = {
	category?: string
	created_at: IsoAutoDateString
	description?: string
	id: string
	is_public?: boolean
	key: string
	updated_at: IsoAutoDateString
	updated_by?: RecordIdString
	value?: null | Tvalue
}

export type TeamMembersRecord<Troles = unknown> = {
	created_at: IsoAutoDateString
	id: string
	is_active?: boolean
	is_admin?: boolean
	roles?: null | Troles
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type UsersRecord = {
	avatar?: FileNameString
	created_at: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	phone?: string
	tokenKey: string
	updated_at: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ActivityLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ActivityLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type AddressesResponse<Texpand = unknown> = Required<AddressesRecord> & BaseSystemFields<Texpand>
export type CategoriesResponse<Tdescription = unknown, Tname = unknown, Texpand = unknown> = Required<CategoriesRecord<Tdescription, Tname>> & BaseSystemFields<Texpand>
export type CheckoutSessionsResponse<Tattribution = unknown, Tbilling_address = unknown, Tline_items = unknown, Tshipping_address = unknown, Texpand = unknown> = Required<CheckoutSessionsRecord<Tattribution, Tbilling_address, Tline_items, Tshipping_address>> & BaseSystemFields<Texpand>
export type ContactMessagesResponse<Texpand = unknown> = Required<ContactMessagesRecord> & BaseSystemFields<Texpand>
export type DiscountCodesResponse<Texpand = unknown> = Required<DiscountCodesRecord> & BaseSystemFields<Texpand>
export type OrderEventsResponse<Texpand = unknown> = Required<OrderEventsRecord> & BaseSystemFields<Texpand>
export type OrderItemsResponse<Texpand = unknown> = Required<OrderItemsRecord> & BaseSystemFields<Texpand>
export type OrdersResponse<Tattribution = unknown, Tbilling_address = unknown, Tshipping_address = unknown, Texpand = unknown> = Required<OrdersRecord<Tattribution, Tbilling_address, Tshipping_address>> & BaseSystemFields<Texpand>
export type PaymentsResponse<Traw = unknown, Texpand = unknown> = Required<PaymentsRecord<Traw>> & BaseSystemFields<Texpand>
export type ProductVariantsResponse<Texpand = unknown> = Required<ProductVariantsRecord> & BaseSystemFields<Texpand>
export type ProductsResponse<Tdescription = unknown, Ttags = unknown, Ttitle = unknown, Texpand = unknown> = Required<ProductsRecord<Tdescription, Ttags, Ttitle>> & BaseSystemFields<Texpand>
export type RolesResponse<Tpermissions = unknown, Texpand = unknown> = Required<RolesRecord<Tpermissions>> & BaseSystemFields<Texpand>
export type SiteSettingsResponse<Tvalue = unknown, Texpand = unknown> = Required<SiteSettingsRecord<Tvalue>> & BaseSystemFields<Texpand>
export type TeamMembersResponse<Troles = unknown, Texpand = unknown> = Required<TeamMembersRecord<Troles>> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	activity_log: ActivityLogRecord
	addresses: AddressesRecord
	categories: CategoriesRecord
	checkout_sessions: CheckoutSessionsRecord
	contact_messages: ContactMessagesRecord
	discount_codes: DiscountCodesRecord
	order_events: OrderEventsRecord
	order_items: OrderItemsRecord
	orders: OrdersRecord
	payments: PaymentsRecord
	product_variants: ProductVariantsRecord
	products: ProductsRecord
	roles: RolesRecord
	site_settings: SiteSettingsRecord
	team_members: TeamMembersRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	activity_log: ActivityLogResponse
	addresses: AddressesResponse
	categories: CategoriesResponse
	checkout_sessions: CheckoutSessionsResponse
	contact_messages: ContactMessagesResponse
	discount_codes: DiscountCodesResponse
	order_events: OrderEventsResponse
	order_items: OrderItemsResponse
	orders: OrdersResponse
	payments: PaymentsResponse
	product_variants: ProductVariantsResponse
	products: ProductsResponse
	roles: RolesResponse
	site_settings: SiteSettingsResponse
	team_members: TeamMembersResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
