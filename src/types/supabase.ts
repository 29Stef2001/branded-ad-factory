export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_analyses: {
        Row: {
          ad_id: string
          call_to_action: string
          created_at: string
          hook: string
          id: string
          messaging_angle: string
          summary: string
          target_audience: string
          tone: string
        }
        Insert: {
          ad_id: string
          call_to_action: string
          created_at?: string
          hook: string
          id?: string
          messaging_angle: string
          summary: string
          target_audience: string
          tone: string
        }
        Update: {
          ad_id?: string
          call_to_action?: string
          created_at?: string
          hook?: string
          id?: string
          messaging_angle?: string
          summary?: string
          target_audience?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_analyses_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: true
            referencedRelation: "competitor_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_concepts: {
        Row: {
          body_copy: string
          brand_asset_requirements: string[]
          brief: string
          call_to_action: string
          campaign_angle: string | null
          concept_code: string | null
          created_at: string
          creative_image_path: string | null
          final_generation_prompt: string | null
          generation_prompt_override: string | null
          generation_retry_count: number
          generation_status: string | null
          headline: string
          hook: string
          id: string
          inspired_by_ad_id: string | null
          origin: string
          product_image_url: string | null
          promotional_message_id: string | null
          refined_from_concept_id: string | null
          strategy_type: string | null
          structured_concept: Json | null
          user_id: string
          visual_direction: string
        }
        Insert: {
          body_copy: string
          brand_asset_requirements?: string[]
          brief: string
          call_to_action: string
          campaign_angle?: string | null
          concept_code?: string | null
          created_at?: string
          creative_image_path?: string | null
          final_generation_prompt?: string | null
          generation_prompt_override?: string | null
          generation_retry_count?: number
          generation_status?: string | null
          headline: string
          hook: string
          id?: string
          inspired_by_ad_id?: string | null
          origin?: string
          product_image_url?: string | null
          promotional_message_id?: string | null
          refined_from_concept_id?: string | null
          strategy_type?: string | null
          structured_concept?: Json | null
          user_id: string
          visual_direction: string
        }
        Update: {
          body_copy?: string
          brand_asset_requirements?: string[]
          brief?: string
          call_to_action?: string
          campaign_angle?: string | null
          concept_code?: string | null
          created_at?: string
          creative_image_path?: string | null
          final_generation_prompt?: string | null
          generation_prompt_override?: string | null
          generation_retry_count?: number
          generation_status?: string | null
          headline?: string
          hook?: string
          id?: string
          inspired_by_ad_id?: string | null
          origin?: string
          product_image_url?: string | null
          promotional_message_id?: string | null
          refined_from_concept_id?: string | null
          strategy_type?: string | null
          structured_concept?: Json | null
          user_id?: string
          visual_direction?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_concepts_inspired_by_ad_id_fkey"
            columns: ["inspired_by_ad_id"]
            isOneToOne: false
            referencedRelation: "competitor_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_concepts_promotional_message_id_fkey"
            columns: ["promotional_message_id"]
            isOneToOne: false
            referencedRelation: "approved_promotional_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_concepts_refined_from_concept_id_fkey"
            columns: ["refined_from_concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights_daily: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_meta_entity_id_fkey"
            columns: ["meta_entity_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights_daily_202507: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202508: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202509: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202510: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202511: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202512: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202601: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202602: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202603: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202604: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202605: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202606: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202607: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      ad_insights_daily_202608: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          add_to_cart_value: number
          clicks: number
          frequency: number | null
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          is_final: boolean
          landing_page_views: number
          leads: number
          link_clicks: number
          meta_entity_id: string
          outbound_clicks: number
          post_engagements: number
          purchases: number
          reach: number
          registrations: number
          revenue: number
          spend: number
          stat_date: string
          synced_at: string
          user_id: string
          video_p100: number
          video_p25: number
          video_p50: number
          video_p75: number
          video_plays: number
          video_thruplays: number
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date: string
          synced_at?: string
          user_id: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          add_to_cart_value?: number
          clicks?: number
          frequency?: number | null
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          is_final?: boolean
          landing_page_views?: number
          leads?: number
          link_clicks?: number
          meta_entity_id?: string
          outbound_clicks?: number
          post_engagements?: number
          purchases?: number
          reach?: number
          registrations?: number
          revenue?: number
          spend?: number
          stat_date?: string
          synced_at?: string
          user_id?: string
          video_p100?: number
          video_p25?: number
          video_p50?: number
          video_p75?: number
          video_plays?: number
          video_thruplays?: number
        }
        Relationships: []
      }
      analysis_runs: {
        Row: {
          analysis_type: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          input_hash: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          prompt_version: string
          result: Json | null
          status: string
          subject_id: string | null
          subject_type: string
          user_id: string
        }
        Insert: {
          analysis_type: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_hash: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          prompt_version: string
          result?: Json | null
          status: string
          subject_id?: string | null
          subject_type: string
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_hash?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          result?: Json | null
          status?: string
          subject_id?: string | null
          subject_type?: string
          user_id?: string
        }
        Relationships: []
      }
      approved_promotional_messages: {
        Row: {
          brand_profile_id: string
          campaign: string | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          message: string
          region: string | null
          sort_order: number
          updated_at: string
          usage_notes: string | null
        }
        Insert: {
          brand_profile_id: string
          campaign?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          region?: string | null
          sort_order?: number
          updated_at?: string
          usage_notes?: string | null
        }
        Update: {
          brand_profile_id?: string
          campaign?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          region?: string | null
          sort_order?: number
          updated_at?: string
          usage_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_promotional_messages_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          asset_type: string
          brand_profile_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_primary: boolean
          label: string | null
          metadata: Json
          region: string | null
          season: string | null
          sort_order: number
          storage_path: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          asset_type: string
          brand_profile_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          metadata?: Json
          region?: string | null
          season?: string | null
          sort_order?: number
          storage_path?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          asset_type?: string
          brand_profile_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          metadata?: Json
          region?: string | null
          season?: string | null
          sort_order?: number
          storage_path?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          brand_category: string | null
          brand_colors: Json | null
          brand_mission: string | null
          brand_name: string
          brand_story: string | null
          brand_values: string[]
          copy_generation_rules: string | null
          created_at: string
          emboss_custom_notes: string | null
          emboss_style: string | null
          foil_custom_notes: string | null
          foil_style: string | null
          founder_age: number | null
          founder_background: string | null
          founder_gender: string | null
          founder_name: string | null
          id: string
          image_generation_rules: string | null
          industry: string | null
          languages: string[]
          logo_image_url: string | null
          logo_rules: string | null
          markets: string[]
          materials: string[]
          metadata: Json
          migration_source: string | null
          photography_style: string | null
          price_positioning: string | null
          product_positioning: string | null
          qa_expectations: string | null
          qa_min_score: number | null
          schema_version: number
          target_audience: string
          tone: string | null
          tone_attributes: string[]
          tone_notes: string | null
          typography_notes: string | null
          unique_selling_points: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          usps: string[]
          visual_style: string | null
          words_to_always_use: string[]
          words_to_never_use: string[]
          writing_style: string | null
        }
        Insert: {
          brand_category?: string | null
          brand_colors?: Json | null
          brand_mission?: string | null
          brand_name: string
          brand_story?: string | null
          brand_values?: string[]
          copy_generation_rules?: string | null
          created_at?: string
          emboss_custom_notes?: string | null
          emboss_style?: string | null
          foil_custom_notes?: string | null
          foil_style?: string | null
          founder_age?: number | null
          founder_background?: string | null
          founder_gender?: string | null
          founder_name?: string | null
          id?: string
          image_generation_rules?: string | null
          industry?: string | null
          languages?: string[]
          logo_image_url?: string | null
          logo_rules?: string | null
          markets?: string[]
          materials?: string[]
          metadata?: Json
          migration_source?: string | null
          photography_style?: string | null
          price_positioning?: string | null
          product_positioning?: string | null
          qa_expectations?: string | null
          qa_min_score?: number | null
          schema_version?: number
          target_audience: string
          tone?: string | null
          tone_attributes?: string[]
          tone_notes?: string | null
          typography_notes?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          usps?: string[]
          visual_style?: string | null
          words_to_always_use?: string[]
          words_to_never_use?: string[]
          writing_style?: string | null
        }
        Update: {
          brand_category?: string | null
          brand_colors?: Json | null
          brand_mission?: string | null
          brand_name?: string
          brand_story?: string | null
          brand_values?: string[]
          copy_generation_rules?: string | null
          created_at?: string
          emboss_custom_notes?: string | null
          emboss_style?: string | null
          foil_custom_notes?: string | null
          foil_style?: string | null
          founder_age?: number | null
          founder_background?: string | null
          founder_gender?: string | null
          founder_name?: string | null
          id?: string
          image_generation_rules?: string | null
          industry?: string | null
          languages?: string[]
          logo_image_url?: string | null
          logo_rules?: string | null
          markets?: string[]
          materials?: string[]
          metadata?: Json
          migration_source?: string | null
          photography_style?: string | null
          price_positioning?: string | null
          product_positioning?: string | null
          qa_expectations?: string | null
          qa_min_score?: number | null
          schema_version?: number
          target_audience?: string
          tone?: string | null
          tone_attributes?: string[]
          tone_notes?: string | null
          typography_notes?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          usps?: string[]
          visual_style?: string | null
          words_to_always_use?: string[]
          words_to_never_use?: string[]
          writing_style?: string | null
        }
        Relationships: []
      }
      competitor_ads: {
        Row: {
          ad_creative_body: string | null
          ad_creative_link_description: string | null
          ad_creative_link_title: string | null
          ad_delivery_start_time: string | null
          ad_snapshot_url: string | null
          competitor_id: string
          created_at: string
          id: string
          meta_ad_archive_id: string
          page_name: string | null
        }
        Insert: {
          ad_creative_body?: string | null
          ad_creative_link_description?: string | null
          ad_creative_link_title?: string | null
          ad_delivery_start_time?: string | null
          ad_snapshot_url?: string | null
          competitor_id: string
          created_at?: string
          id?: string
          meta_ad_archive_id: string
          page_name?: string | null
        }
        Update: {
          ad_creative_body?: string | null
          ad_creative_link_description?: string | null
          ad_creative_link_title?: string | null
          ad_delivery_start_time?: string | null
          ad_snapshot_url?: string | null
          competitor_id?: string
          created_at?: string
          id?: string
          meta_ad_archive_id?: string
          page_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_ads_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          id: string
          meta_page_id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_page_id: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_page_id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      creative_features: {
        Row: {
          analysis_run_id: string | null
          angle: string | null
          awareness_level: string | null
          brightness: string | null
          composition: string | null
          content_hash: string
          created_at: string
          dominant_colors: string[] | null
          emotional_driver: string | null
          format: string | null
          has_person: boolean | null
          hook_text: string | null
          hook_type: string | null
          id: string
          meta_entity_id: string
          offer_strength: string | null
          offer_type: string | null
          proof_type: string | null
          shows_product: boolean | null
          text_on_image: boolean | null
          updated_at: string
          user_id: string
          visual_pattern: string | null
          why_it_works: string[] | null
        }
        Insert: {
          analysis_run_id?: string | null
          angle?: string | null
          awareness_level?: string | null
          brightness?: string | null
          composition?: string | null
          content_hash: string
          created_at?: string
          dominant_colors?: string[] | null
          emotional_driver?: string | null
          format?: string | null
          has_person?: boolean | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          meta_entity_id: string
          offer_strength?: string | null
          offer_type?: string | null
          proof_type?: string | null
          shows_product?: boolean | null
          text_on_image?: boolean | null
          updated_at?: string
          user_id: string
          visual_pattern?: string | null
          why_it_works?: string[] | null
        }
        Update: {
          analysis_run_id?: string | null
          angle?: string | null
          awareness_level?: string | null
          brightness?: string | null
          composition?: string | null
          content_hash?: string
          created_at?: string
          dominant_colors?: string[] | null
          emotional_driver?: string | null
          format?: string | null
          has_person?: boolean | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          meta_entity_id?: string
          offer_strength?: string | null
          offer_type?: string | null
          proof_type?: string | null
          shows_product?: boolean | null
          text_on_image?: boolean | null
          updated_at?: string
          user_id?: string
          visual_pattern?: string | null
          why_it_works?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_features_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_features_meta_entity_id_fkey"
            columns: ["meta_entity_id"]
            isOneToOne: true
            referencedRelation: "meta_ad_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_generations: {
        Row: {
          attempt_number: number
          concept_id: string
          created_at: string
          detected_issues: string[]
          failure_reason: string | null
          id: string
          image_path: string | null
          perceptual_hash: string | null
          qa_notes: string | null
          qa_passed: boolean | null
          qa_score: number | null
          qa_scores: Json | null
          qa_suggested_prompt: string | null
          retry_reason: string | null
          reviewed_at: string | null
          selected_reference_roles: string[]
          status: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          concept_id: string
          created_at?: string
          detected_issues?: string[]
          failure_reason?: string | null
          id?: string
          image_path?: string | null
          perceptual_hash?: string | null
          qa_notes?: string | null
          qa_passed?: boolean | null
          qa_score?: number | null
          qa_scores?: Json | null
          qa_suggested_prompt?: string | null
          retry_reason?: string | null
          reviewed_at?: string | null
          selected_reference_roles?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          concept_id?: string
          created_at?: string
          detected_issues?: string[]
          failure_reason?: string | null
          id?: string
          image_path?: string | null
          perceptual_hash?: string | null
          qa_notes?: string | null
          qa_passed?: boolean | null
          qa_score?: number | null
          qa_scores?: Json | null
          qa_suggested_prompt?: string | null
          retry_reason?: string | null
          reviewed_at?: string | null
          selected_reference_roles?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_generations_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_links: {
        Row: {
          concept_id: string
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          generation_id: string | null
          id: string
          match_confidence: number
          match_method: string
          meta_entity_id: string
          user_id: string
        }
        Insert: {
          concept_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          match_confidence: number
          match_method: string
          meta_entity_id: string
          user_id: string
        }
        Update: {
          concept_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          match_confidence?: number
          match_method?: string
          meta_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_links_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_links_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "creative_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_links_meta_entity_id_fkey"
            columns: ["meta_entity_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_metrics: {
        Row: {
          ad_account_id: string | null
          add_to_cart: number
          clicks: number
          composite_score: number | null
          computed_at: string
          concept_id: string | null
          conversion_rate: number | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          ctr: number | null
          ctr_lower_bound: number | null
          evidence_tier: string
          id: string
          impressions: number
          initiate_checkout: number
          landing_page_views: number
          link_clicks: number
          link_ctr: number | null
          meta_entity_id: string | null
          percentile_rank: number | null
          primary_metric: string | null
          purchases: number
          reach: number
          revenue: number
          roas: number | null
          roas_shrunk: number | null
          spend: number
          user_id: string
          window_days: number
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          ad_account_id?: string | null
          add_to_cart?: number
          clicks?: number
          composite_score?: number | null
          computed_at?: string
          concept_id?: string | null
          conversion_rate?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          ctr_lower_bound?: number | null
          evidence_tier: string
          id?: string
          impressions?: number
          initiate_checkout?: number
          landing_page_views?: number
          link_clicks?: number
          link_ctr?: number | null
          meta_entity_id?: string | null
          percentile_rank?: number | null
          primary_metric?: string | null
          purchases?: number
          reach?: number
          revenue?: number
          roas?: number | null
          roas_shrunk?: number | null
          spend?: number
          user_id: string
          window_days: number
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          ad_account_id?: string | null
          add_to_cart?: number
          clicks?: number
          composite_score?: number | null
          computed_at?: string
          concept_id?: string | null
          conversion_rate?: number | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          ctr_lower_bound?: number | null
          evidence_tier?: string
          id?: string
          impressions?: number
          initiate_checkout?: number
          landing_page_views?: number
          link_clicks?: number
          link_ctr?: number | null
          meta_entity_id?: string | null
          percentile_rank?: number | null
          primary_metric?: string | null
          purchases?: number
          reach?: number
          revenue?: number
          roas?: number | null
          roas_shrunk?: number | null
          spend?: number
          user_id?: string
          window_days?: number
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_metrics_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_metrics_meta_entity_id_fkey"
            columns: ["meta_entity_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          cursor: Json | null
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          processed_count: number
          started_at: string
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          processed_count?: number
          started_at?: string
          status: string
          trigger: string
          user_id: string
        }
        Update: {
          created_at?: string
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          processed_count?: number
          started_at?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      launch_batches: {
        Row: {
          ad_account_id: string
          ad_status: string
          adset_meta_id: string | null
          adset_name: string | null
          age_max: number | null
          age_min: number | null
          campaign_meta_id: string | null
          campaign_name: string | null
          countries: string[]
          created_at: string
          custom_event_type: string | null
          daily_budget_minor: number | null
          dry_run: boolean
          error: string | null
          finished_at: string | null
          id: string
          objective: string | null
          page_id: string | null
          pixel_id: string | null
          start_time: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          ad_status?: string
          adset_meta_id?: string | null
          adset_name?: string | null
          age_max?: number | null
          age_min?: number | null
          campaign_meta_id?: string | null
          campaign_name?: string | null
          countries?: string[]
          created_at?: string
          custom_event_type?: string | null
          daily_budget_minor?: number | null
          dry_run?: boolean
          error?: string | null
          finished_at?: string | null
          id?: string
          objective?: string | null
          page_id?: string | null
          pixel_id?: string | null
          start_time?: string | null
          started_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          ad_status?: string
          adset_meta_id?: string | null
          adset_name?: string | null
          age_max?: number | null
          age_min?: number | null
          campaign_meta_id?: string | null
          campaign_name?: string | null
          countries?: string[]
          created_at?: string
          custom_event_type?: string | null
          daily_budget_minor?: number | null
          dry_run?: boolean
          error?: string | null
          finished_at?: string | null
          id?: string
          objective?: string | null
          page_id?: string | null
          pixel_id?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      launch_items: {
        Row: {
          ad_meta_id: string | null
          ad_name: string
          batch_id: string
          call_to_action: string
          concept_id: string | null
          created_at: string
          creative_meta_id: string | null
          description: string | null
          error: string | null
          error_subcode: number | null
          headline: string
          id: string
          image_hash: string | null
          image_url: string
          link_url: string
          position: number
          primary_text: string
          status: string
          updated_at: string
        }
        Insert: {
          ad_meta_id?: string | null
          ad_name: string
          batch_id: string
          call_to_action?: string
          concept_id?: string | null
          created_at?: string
          creative_meta_id?: string | null
          description?: string | null
          error?: string | null
          error_subcode?: number | null
          headline: string
          id?: string
          image_hash?: string | null
          image_url: string
          link_url: string
          position: number
          primary_text: string
          status?: string
          updated_at?: string
        }
        Update: {
          ad_meta_id?: string | null
          ad_name?: string
          batch_id?: string
          call_to_action?: string
          concept_id?: string | null
          created_at?: string
          creative_meta_id?: string | null
          description?: string | null
          error?: string | null
          error_subcode?: number | null
          headline?: string
          id?: string
          image_hash?: string | null
          image_url?: string
          link_url?: string
          position?: number
          primary_text?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "launch_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_items_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_account_connections: {
        Row: {
          access_token: string
          ad_account_id: string
          created_at: string
          id: string
          token_expires_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          ad_account_id: string
          created_at?: string
          id?: string
          token_expires_at: string
          user_id: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string
          created_at?: string
          id?: string
          token_expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_ad_accounts: {
        Row: {
          account_status: number | null
          ad_account_id: string
          business_name: string | null
          created_at: string
          currency: string | null
          first_seen_at: string
          id: string
          is_default: boolean
          is_selected: boolean
          last_synced_at: string | null
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: number | null
          ad_account_id: string
          business_name?: string | null
          created_at?: string
          currency?: string | null
          first_seen_at?: string
          id?: string
          is_default?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: number | null
          ad_account_id?: string
          business_name?: string | null
          created_at?: string
          currency?: string | null
          first_seen_at?: string
          id?: string
          is_default?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_ad_entities: {
        Row: {
          ad_account_id: string | null
          created_at: string
          creative_meta_id: string | null
          effective_status: string | null
          entity_type: string
          first_seen_at: string
          id: string
          image_hash: string | null
          last_synced_at: string
          meta_id: string
          name: string
          parent_meta_id: string | null
          perceptual_hash: string | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          created_at?: string
          creative_meta_id?: string | null
          effective_status?: string | null
          entity_type: string
          first_seen_at?: string
          id?: string
          image_hash?: string | null
          last_synced_at?: string
          meta_id: string
          name: string
          parent_meta_id?: string | null
          perceptual_hash?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          created_at?: string
          creative_meta_id?: string | null
          effective_status?: string | null
          entity_type?: string
          first_seen_at?: string
          id?: string
          image_hash?: string | null
          last_synced_at?: string
          meta_id?: string
          name?: string
          parent_meta_id?: string | null
          perceptual_hash?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_launch_attempts: {
        Row: {
          ad_account_id: string
          concept_id: string
          created_at: string
          error_detail: Json | null
          id: string
          launch_mode: string
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_creative_id: string | null
          request_payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          concept_id: string
          created_at?: string
          error_detail?: Json | null
          id?: string
          launch_mode?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          request_payload?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          concept_id?: string
          created_at?: string
          error_detail?: Json | null
          id?: string
          launch_mode?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          request_payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_launch_attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ad_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          created_at: string
          id: string
          instagram_actor_id: string | null
          is_default: boolean
          name: string | null
          page_access_token: string | null
          page_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instagram_actor_id?: string | null
          is_default?: boolean
          name?: string | null
          page_access_token?: string | null
          page_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instagram_actor_id?: string | null
          is_default?: boolean
          name?: string | null
          page_access_token?: string | null
          page_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_insights_partition: {
        Args: { target: string }
        Returns: undefined
      }
      generate_concept_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
