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
	ApiKeys: "api_keys",
	Categories: "categories",
	CheckoutSessions: "checkout_sessions",
	CollectionProducts: "collection_products",
	Collections: "collections",
	ContactMessages: "contact_messages",
	CustomerNotes: "customer_notes",
	DiscountCodes: "discount_codes",
	Domains: "domains",
	DraftOrders: "draft_orders",
	EmailLog: "email_log",
	GiftCardTransactions: "gift_card_transactions",
	GiftCards: "gift_cards",
	InventoryAdjustments: "inventory_adjustments",
	Media: "media",
	OrderEvents: "order_events",
	OrderItems: "order_items",
	Orders: "orders",
	Pages: "pages",
	Payments: "payments",
	ProductVariants: "product_variants",
	Products: "products",
	Refunds: "refunds",
	Reviews: "reviews",
	Roles: "roles",
	SavedViews: "saved_views",
	SiteAssets: "site_assets",
	SiteSettings: "site_settings",
	TeamMembers: "team_members",
	Themes: "themes",
	Users: "users",
	WishlistItems: "wishlist_items",
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

export type ApiKeysRecord = {
	created_at: IsoAutoDateString
	id: string
	key_hash: string
	key_prefix: string
	last_used_at?: IsoDateString
	name: string
	revoked_at?: IsoDateString
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type CategoriesRecord<Tdescription = unknown, Tname = unknown, Tseo = unknown> = {
	created_at: IsoAutoDateString
	description?: null | Tdescription
	id: string
	image?: FileNameString
	is_active?: boolean
	name: null | Tname
	parent?: RecordIdString
	seo?: null | Tseo
	slug: string
	sort_order?: number
	updated_at: IsoAutoDateString
}

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
	contact_at?: IsoDateString
	created_at: IsoAutoDateString
	currency?: string
	customer_note?: string
	discount_code?: RecordIdString
	discount_total?: number
	email?: string
	expires_at?: IsoDateString
	gift_card_amount?: number
	gift_card_id?: string
	id: string
	line_items?: null | Tline_items
	locale?: string
	payment_method?: string
	phone?: string
	recovery_sent_at?: IsoDateString
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

export type CollectionProductsRecord = {
	collection: RecordIdString
	created_at: IsoAutoDateString
	id: string
	position?: number
	product: RecordIdString
	updated_at: IsoAutoDateString
}

export const CollectionsKindOptions = {
	"manual": "manual",
	"automatic": "automatic",
} as const
export type CollectionsKindOptions = typeof CollectionsKindOptions[keyof typeof CollectionsKindOptions]

export const CollectionsSortOptions = {
	"manual": "manual",
	"newest": "newest",
	"price_asc": "price_asc",
	"price_desc": "price_desc",
	"title": "title",
} as const
export type CollectionsSortOptions = typeof CollectionsSortOptions[keyof typeof CollectionsSortOptions]
export type CollectionsRecord<Tdescription = unknown, Trules = unknown, Tseo = unknown, Ttitle = unknown> = {
	created_at: IsoAutoDateString
	description?: null | Tdescription
	id: string
	image_url?: string
	is_published?: boolean
	kind: CollectionsKindOptions
	rules?: null | Trules
	seo?: null | Tseo
	slug: string
	sort: CollectionsSortOptions
	sort_order?: number
	title?: null | Ttitle
	updated_at: IsoAutoDateString
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

export type CustomerNotesRecord = {
	created_at: IsoAutoDateString
	customer_key: string
	id: string
	note?: string
	updated_at: IsoAutoDateString
	updated_by?: RecordIdString
}

export const DiscountCodesTypeOptions = {
	"percent": "percent",
	"fixed": "fixed",
	"free_shipping": "free_shipping",
} as const
export type DiscountCodesTypeOptions = typeof DiscountCodesTypeOptions[keyof typeof DiscountCodesTypeOptions]
export type DiscountCodesRecord<Tapplies_to = unknown> = {
	applies_to?: null | Tapplies_to
	code: string
	created_at: IsoAutoDateString
	deleted_at?: IsoDateString
	ends_at?: IsoDateString
	id: string
	is_active?: boolean
	min_subtotal?: number
	once_per_customer?: boolean
	starts_at?: IsoDateString
	title?: string
	type: DiscountCodesTypeOptions
	updated_at: IsoAutoDateString
	usage_limit?: number
	used_count?: number
	value?: number
}

export const DomainsTargetOptions = {
	"store": "store",
	"admin": "admin",
} as const
export type DomainsTargetOptions = typeof DomainsTargetOptions[keyof typeof DomainsTargetOptions]

export const DomainsStatusOptions = {
	"pending": "pending",
	"verifying": "verifying",
	"active": "active",
	"error": "error",
} as const
export type DomainsStatusOptions = typeof DomainsStatusOptions[keyof typeof DomainsStatusOptions]
export type DomainsRecord<Tdns_records = unknown> = {
	created_at: IsoAutoDateString
	dns_records?: null | Tdns_records
	hostname: string
	id: string
	is_primary?: boolean
	last_checked_at?: IsoDateString
	last_error?: string
	provider_ref?: string
	status: DomainsStatusOptions
	target: DomainsTargetOptions
	updated_at: IsoAutoDateString
}

export type DraftOrdersRecord<Tdiscount = unknown, Tlines = unknown, Tshipping_address = unknown> = {
	checkout_session?: string
	created_at: IsoAutoDateString
	created_by?: string
	currency?: string
	customer_name?: string
	discount?: null | Tdiscount
	draft_number?: number
	email?: string
	has_shipping_price?: boolean
	id: string
	lines?: null | Tlines
	locale?: string
	note?: string
	order?: RecordIdString
	phone?: string
	shipping_address?: null | Tshipping_address
	shipping_method?: string
	shipping_price?: number
	status: string
	total?: number
	updated_at: IsoAutoDateString
	user?: RecordIdString
}

export type EmailLogRecord = {
	created_at: IsoAutoDateString
	error?: string
	id: string
	order?: RecordIdString
	recipient: string
	status: string
	subject?: string
	template: string
	updated_at: IsoAutoDateString
}

export type GiftCardTransactionsRecord = {
	amount?: number
	created_at: IsoAutoDateString
	gift_card: RecordIdString
	id: string
	note?: string
	order_id?: string
	updated_at: IsoAutoDateString
}

export type GiftCardsRecord = {
	balance?: number
	code: string
	created_at: IsoAutoDateString
	created_by?: string
	currency?: string
	customer_email?: string
	expires_at?: IsoDateString
	id: string
	initial_value?: number
	is_active?: boolean
	note?: string
	order?: RecordIdString
	updated_at: IsoAutoDateString
}

export type InventoryAdjustmentsRecord = {
	actor_id?: string
	created_at: IsoAutoDateString
	delta?: number
	id: string
	note?: string
	reason: string
	stock_after?: number
	updated_at: IsoAutoDateString
	variant?: RecordIdString
}

export type MediaRecord = {
	created_at: IsoAutoDateString
	file: FileNameString
	id: string
	name?: string
	size?: number
	updated_at: IsoAutoDateString
}

export const OrderEventsTypeOptions = {
	"created": "created",
	"status_changed": "status_changed",
	"payment_status_changed": "payment_status_changed",
	"note": "note",
	"shipped": "shipped",
	"email_sent": "email_sent",
	"refund": "refund",
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
	"partially_refunded": "partially_refunded",
	"refunded": "refunded",
} as const
export type OrdersPaymentStatusOptions = typeof OrdersPaymentStatusOptions[keyof typeof OrdersPaymentStatusOptions]
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
	gift_card_total?: number
	id: string
	internal_note?: string
	locale?: string
	order_number?: number
	paid_at?: IsoDateString
	payment_method?: string
	payment_status: OrdersPaymentStatusOptions
	phone?: string
	refunded_total?: number
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

export type PagesRecord<Tsections = unknown, Tseo = unknown, Ttitle = unknown> = {
	created_at: IsoAutoDateString
	id: string
	is_published?: boolean
	sections?: null | Tsections
	seo?: null | Tseo
	slug: string
	title?: null | Ttitle
	updated_at: IsoAutoDateString
}

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
	provider?: string
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
export type ProductsRecord<Tdescription = unknown, Timage_colors = unknown, Tseo = unknown, Ttags = unknown, Ttitle = unknown> = {
	category?: RecordIdString
	compare_at_price?: number
	created_at: IsoAutoDateString
	deleted_at?: IsoDateString
	description?: null | Tdescription
	id: string
	image_colors?: null | Timage_colors
	images?: FileNameString[]
	is_featured?: boolean
	is_gift_card?: boolean
	price?: number
	seo?: null | Tseo
	slug: string
	status: ProductsStatusOptions
	tags?: null | Ttags
	title: null | Ttitle
	updated_at: IsoAutoDateString
}

export type RefundsRecord<Tlines = unknown> = {
	actor_id?: string
	amount?: number
	created_at: IsoAutoDateString
	id: string
	lines?: null | Tlines
	order: RecordIdString
	provider_ref?: string
	reason?: string
	restocked?: boolean
	updated_at: IsoAutoDateString
}

export const ReviewsStatusOptions = {
	"pending": "pending",
	"approved": "approved",
	"hidden": "hidden",
} as const
export type ReviewsStatusOptions = typeof ReviewsStatusOptions[keyof typeof ReviewsStatusOptions]
export type ReviewsRecord = {
	author_name: string
	body: string
	created_at: IsoAutoDateString
	email?: string
	id: string
	locale?: string
	product: RecordIdString
	rating?: number
	reply?: string
	status: ReviewsStatusOptions
	title?: string
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type RolesRecord<Tpermissions = unknown> = {
	created_at: IsoAutoDateString
	description?: string
	id: string
	is_read_only?: boolean
	is_system?: boolean
	name: string
	permissions?: null | Tpermissions
	updated_at: IsoAutoDateString
}

export type SavedViewsRecord<Tfilters = unknown> = {
	created_at: IsoAutoDateString
	filters?: null | Tfilters
	id: string
	name: string
	resource: string
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type SiteAssetsRecord = {
	created_at: IsoAutoDateString
	file?: FileNameString
	id: string
	kind: string
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
	locale?: string
	roles?: null | Troles
	updated_at: IsoAutoDateString
	user: RecordIdString
}

export type ThemesRecord<Tdraft = unknown, Thistory = unknown, Tpublished = unknown> = {
	created_at: IsoAutoDateString
	draft?: null | Tdraft
	history?: null | Thistory
	id: string
	is_live?: boolean
	name: string
	published?: null | Tpublished
	published_at?: IsoDateString
	template: string
	updated_at: IsoAutoDateString
}

export type UsersRecord = {
	accepts_marketing?: boolean
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

export type WishlistItemsRecord = {
	created_at: IsoAutoDateString
	id: string
	product: RecordIdString
	updated_at: IsoAutoDateString
	user: RecordIdString
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ActivityLogResponse<Tdetails = unknown, Texpand = unknown> = Required<ActivityLogRecord<Tdetails>> & BaseSystemFields<Texpand>
export type AddressesResponse<Texpand = unknown> = Required<AddressesRecord> & BaseSystemFields<Texpand>
export type ApiKeysResponse<Texpand = unknown> = Required<ApiKeysRecord> & BaseSystemFields<Texpand>
export type CategoriesResponse<Tdescription = unknown, Tname = unknown, Tseo = unknown, Texpand = unknown> = Required<CategoriesRecord<Tdescription, Tname, Tseo>> & BaseSystemFields<Texpand>
export type CheckoutSessionsResponse<Tattribution = unknown, Tbilling_address = unknown, Tline_items = unknown, Tshipping_address = unknown, Texpand = unknown> = Required<CheckoutSessionsRecord<Tattribution, Tbilling_address, Tline_items, Tshipping_address>> & BaseSystemFields<Texpand>
export type CollectionProductsResponse<Texpand = unknown> = Required<CollectionProductsRecord> & BaseSystemFields<Texpand>
export type CollectionsResponse<Tdescription = unknown, Trules = unknown, Tseo = unknown, Ttitle = unknown, Texpand = unknown> = Required<CollectionsRecord<Tdescription, Trules, Tseo, Ttitle>> & BaseSystemFields<Texpand>
export type ContactMessagesResponse<Texpand = unknown> = Required<ContactMessagesRecord> & BaseSystemFields<Texpand>
export type CustomerNotesResponse<Texpand = unknown> = Required<CustomerNotesRecord> & BaseSystemFields<Texpand>
export type DiscountCodesResponse<Tapplies_to = unknown, Texpand = unknown> = Required<DiscountCodesRecord<Tapplies_to>> & BaseSystemFields<Texpand>
export type DomainsResponse<Tdns_records = unknown, Texpand = unknown> = Required<DomainsRecord<Tdns_records>> & BaseSystemFields<Texpand>
export type DraftOrdersResponse<Tdiscount = unknown, Tlines = unknown, Tshipping_address = unknown, Texpand = unknown> = Required<DraftOrdersRecord<Tdiscount, Tlines, Tshipping_address>> & BaseSystemFields<Texpand>
export type EmailLogResponse<Texpand = unknown> = Required<EmailLogRecord> & BaseSystemFields<Texpand>
export type GiftCardTransactionsResponse<Texpand = unknown> = Required<GiftCardTransactionsRecord> & BaseSystemFields<Texpand>
export type GiftCardsResponse<Texpand = unknown> = Required<GiftCardsRecord> & BaseSystemFields<Texpand>
export type InventoryAdjustmentsResponse<Texpand = unknown> = Required<InventoryAdjustmentsRecord> & BaseSystemFields<Texpand>
export type MediaResponse<Texpand = unknown> = Required<MediaRecord> & BaseSystemFields<Texpand>
export type OrderEventsResponse<Texpand = unknown> = Required<OrderEventsRecord> & BaseSystemFields<Texpand>
export type OrderItemsResponse<Texpand = unknown> = Required<OrderItemsRecord> & BaseSystemFields<Texpand>
export type OrdersResponse<Tattribution = unknown, Tbilling_address = unknown, Tshipping_address = unknown, Texpand = unknown> = Required<OrdersRecord<Tattribution, Tbilling_address, Tshipping_address>> & BaseSystemFields<Texpand>
export type PagesResponse<Tsections = unknown, Tseo = unknown, Ttitle = unknown, Texpand = unknown> = Required<PagesRecord<Tsections, Tseo, Ttitle>> & BaseSystemFields<Texpand>
export type PaymentsResponse<Traw = unknown, Texpand = unknown> = Required<PaymentsRecord<Traw>> & BaseSystemFields<Texpand>
export type ProductVariantsResponse<Texpand = unknown> = Required<ProductVariantsRecord> & BaseSystemFields<Texpand>
export type ProductsResponse<Tdescription = unknown, Timage_colors = unknown, Tseo = unknown, Ttags = unknown, Ttitle = unknown, Texpand = unknown> = Required<ProductsRecord<Tdescription, Timage_colors, Tseo, Ttags, Ttitle>> & BaseSystemFields<Texpand>
export type RefundsResponse<Tlines = unknown, Texpand = unknown> = Required<RefundsRecord<Tlines>> & BaseSystemFields<Texpand>
export type ReviewsResponse<Texpand = unknown> = Required<ReviewsRecord> & BaseSystemFields<Texpand>
export type RolesResponse<Tpermissions = unknown, Texpand = unknown> = Required<RolesRecord<Tpermissions>> & BaseSystemFields<Texpand>
export type SavedViewsResponse<Tfilters = unknown, Texpand = unknown> = Required<SavedViewsRecord<Tfilters>> & BaseSystemFields<Texpand>
export type SiteAssetsResponse<Texpand = unknown> = Required<SiteAssetsRecord> & BaseSystemFields<Texpand>
export type SiteSettingsResponse<Tvalue = unknown, Texpand = unknown> = Required<SiteSettingsRecord<Tvalue>> & BaseSystemFields<Texpand>
export type TeamMembersResponse<Troles = unknown, Texpand = unknown> = Required<TeamMembersRecord<Troles>> & BaseSystemFields<Texpand>
export type ThemesResponse<Tdraft = unknown, Thistory = unknown, Tpublished = unknown, Texpand = unknown> = Required<ThemesRecord<Tdraft, Thistory, Tpublished>> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type WishlistItemsResponse<Texpand = unknown> = Required<WishlistItemsRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	activity_log: ActivityLogRecord
	addresses: AddressesRecord
	api_keys: ApiKeysRecord
	categories: CategoriesRecord
	checkout_sessions: CheckoutSessionsRecord
	collection_products: CollectionProductsRecord
	collections: CollectionsRecord
	contact_messages: ContactMessagesRecord
	customer_notes: CustomerNotesRecord
	discount_codes: DiscountCodesRecord
	domains: DomainsRecord
	draft_orders: DraftOrdersRecord
	email_log: EmailLogRecord
	gift_card_transactions: GiftCardTransactionsRecord
	gift_cards: GiftCardsRecord
	inventory_adjustments: InventoryAdjustmentsRecord
	media: MediaRecord
	order_events: OrderEventsRecord
	order_items: OrderItemsRecord
	orders: OrdersRecord
	pages: PagesRecord
	payments: PaymentsRecord
	product_variants: ProductVariantsRecord
	products: ProductsRecord
	refunds: RefundsRecord
	reviews: ReviewsRecord
	roles: RolesRecord
	saved_views: SavedViewsRecord
	site_assets: SiteAssetsRecord
	site_settings: SiteSettingsRecord
	team_members: TeamMembersRecord
	themes: ThemesRecord
	users: UsersRecord
	wishlist_items: WishlistItemsRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	activity_log: ActivityLogResponse
	addresses: AddressesResponse
	api_keys: ApiKeysResponse
	categories: CategoriesResponse
	checkout_sessions: CheckoutSessionsResponse
	collection_products: CollectionProductsResponse
	collections: CollectionsResponse
	contact_messages: ContactMessagesResponse
	customer_notes: CustomerNotesResponse
	discount_codes: DiscountCodesResponse
	domains: DomainsResponse
	draft_orders: DraftOrdersResponse
	email_log: EmailLogResponse
	gift_card_transactions: GiftCardTransactionsResponse
	gift_cards: GiftCardsResponse
	inventory_adjustments: InventoryAdjustmentsResponse
	media: MediaResponse
	order_events: OrderEventsResponse
	order_items: OrderItemsResponse
	orders: OrdersResponse
	pages: PagesResponse
	payments: PaymentsResponse
	product_variants: ProductVariantsResponse
	products: ProductsResponse
	refunds: RefundsResponse
	reviews: ReviewsResponse
	roles: RolesResponse
	saved_views: SavedViewsResponse
	site_assets: SiteAssetsResponse
	site_settings: SiteSettingsResponse
	team_members: TeamMembersResponse
	themes: ThemesResponse
	users: UsersResponse
	wishlist_items: WishlistItemsResponse
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
