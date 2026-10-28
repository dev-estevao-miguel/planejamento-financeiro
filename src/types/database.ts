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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          household_id: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          household_id: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          household_id?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          alert_threshold_pct: number
          budget_id: string
          category_id: string
          created_at: string
          household_id: string
          id: string
          notes: string | null
          planned_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_threshold_pct?: number
          budget_id: string
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          notes?: string | null
          planned_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_threshold_pct?: number
          budget_id?: string
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          notes?: string | null
          planned_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_fk"
            columns: ["household_id", "budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "budget_items_category_fk"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "budget_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          month: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          household_id: string
          icon: string | null
          id: string
          is_essential: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          is_essential?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          is_essential?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_fk"
            columns: ["household_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          achieved_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          household_id: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          notes: string | null
          starting_amount: number
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name: string
          notes?: string | null
          starting_amount?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          notes?: string | null
          starting_amount?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_on: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          goal_id: string
          household_id: string
          id: string
          member_id: string | null
          notes: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          contributed_on: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id: string
          household_id: string
          id?: string
          member_id?: string | null
          notes?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contributed_on?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string
          household_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_fk"
            columns: ["household_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "goal_contributions_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "goal_contributions_transaction_fk"
            columns: ["household_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      goal_members: {
        Row: {
          goal_id: string
          household_id: string
          member_id: string
        }
        Insert: {
          goal_id: string
          household_id: string
          member_id: string
        }
        Update: {
          goal_id?: string
          household_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_members_goal_fk"
            columns: ["household_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "goal_members_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string | null
          relationship: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["household_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at: string
          household_id: string
          id?: string
          invited_by?: string | null
          relationship?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          relationship?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string | null
          household_id: string
          id: string
          joined_at: string
          profile_id: string | null
          relationship: string | null
          role: Database["public"]["Enums"]["household_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          household_id: string
          id?: string
          joined_at?: string
          profile_id?: string | null
          relationship?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          household_id?: string
          id?: string
          joined_at?: string
          profile_id?: string | null
          relationship?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          emergency_reserve_months: number
          id: string
          locale: string
          name: string
          plan_code: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          emergency_reserve_months?: number
          id?: string
          locale?: string
          name: string
          plan_code?: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          emergency_reserve_months?: number
          id?: string
          locale?: string
          name?: string
          plan_code?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          entry_date: string
          household_id: string
          id: string
          investment_id: string
          kind: Database["public"]["Enums"]["investment_entry_kind"]
          notes: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entry_date: string
          household_id: string
          id?: string
          investment_id: string
          kind: Database["public"]["Enums"]["investment_entry_kind"]
          notes?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entry_date?: string
          household_id?: string
          id?: string
          investment_id?: string
          kind?: Database["public"]["Enums"]["investment_entry_kind"]
          notes?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_entries_investment_fk"
            columns: ["household_id", "investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "investment_entries_transaction_fk"
            columns: ["household_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      investments: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          goal_id: string | null
          household_id: string
          id: string
          institution: string | null
          member_id: string | null
          name: string
          notes: string | null
          objective: string | null
          type: Database["public"]["Enums"]["investment_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          household_id: string
          id?: string
          institution?: string | null
          member_id?: string | null
          name: string
          notes?: string | null
          objective?: string | null
          type: Database["public"]["Enums"]["investment_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          household_id?: string
          id?: string
          institution?: string | null
          member_id?: string | null
          name?: string
          notes?: string | null
          objective?: string | null
          type?: Database["public"]["Enums"]["investment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_goal_fk"
            columns: ["household_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "investments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          created_at: string
          granted: boolean
          household_id: string
          member_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          created_at?: string
          granted: boolean
          household_id: string
          member_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          created_at?: string
          granted?: boolean
          household_id?: string
          member_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          household_id: string
          in_app: boolean
          profile_id: string
          push: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
        }
        Insert: {
          household_id: string
          in_app?: boolean
          profile_id: string
          push?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Update: {
          household_id?: string
          in_app?: boolean
          profile_id?: string
          push?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string | null
          household_id: string
          id: string
          read_at: string | null
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          household_id: string
          id?: string
          read_at?: string | null
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          household_id?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          archived_at: string | null
          closing_day: number | null
          created_at: string
          due_day: number | null
          household_id: string
          id: string
          name: string
          owner_member_id: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          closing_day?: number | null
          created_at?: string
          due_day?: number | null
          household_id: string
          id?: string
          name: string
          owner_member_id?: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          closing_day?: number | null
          created_at?: string
          due_day?: number | null
          household_id?: string
          id?: string
          name?: string
          owner_member_id?: string | null
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_owner_fk"
            columns: ["household_id", "owner_member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          created_at: string
          phone_e164: string | null
          phone_verified_at: string | null
          profile_id: string
          recovery_email: string | null
          recovery_email_verified_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          profile_id: string
          recovery_email?: string | null
          recovery_email_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          profile_id?: string
          recovery_email?: string | null
          recovery_email_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username: string
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          device_label: string | null
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          profile_id: string
          revoked_at: string | null
          user_agent: string | null
        }
        Insert: {
          auth_secret: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          profile_id: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_secret?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          profile_id?: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          default_status: Database["public"]["Enums"]["transaction_status"]
          description: string
          ends_on: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          generated_until: string | null
          household_id: string
          id: string
          interval_count: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id: string | null
          notes: string | null
          paused_at: string | null
          payment_method_id: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          default_status?: Database["public"]["Enums"]["transaction_status"]
          description: string
          ends_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          generated_until?: string | null
          household_id: string
          id?: string
          interval_count?: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          notes?: string | null
          paused_at?: string | null
          payment_method_id?: string | null
          starts_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          default_status?: Database["public"]["Enums"]["transaction_status"]
          description?: string
          ends_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          generated_until?: string | null
          household_id?: string
          id?: string
          interval_count?: number
          kind?: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          notes?: string | null
          paused_at?: string | null
          payment_method_id?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_fk"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "recurring_rules_payment_method_fk"
            columns: ["household_id", "payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["household_role"]
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["household_role"]
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["household_role"]
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          competence_month: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          due_on: string | null
          household_id: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_planned: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id: string | null
          notes: string | null
          occurred_on: string
          occurrence_date: string | null
          payment_method_id: string | null
          recurring_rule_id: string | null
          search_text: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          updated_by: string | null
          visibility: Database["public"]["Enums"]["record_visibility"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          competence_month: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          due_on?: string | null
          household_id: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_planned?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          notes?: string | null
          occurred_on: string
          occurrence_date?: string | null
          payment_method_id?: string | null
          recurring_rule_id?: string | null
          search_text?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["record_visibility"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          competence_month?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          due_on?: string | null
          household_id?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_planned?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          notes?: string | null
          occurred_on?: string
          occurrence_date?: string | null
          payment_method_id?: string | null
          recurring_rule_id?: string | null
          search_text?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["record_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_fk"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_fk"
            columns: ["household_id", "member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_payment_method_fk"
            columns: ["household_id", "payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_fk"
            columns: ["household_id", "recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_household_id: string | null
          locale: string
          onboarding_completed_at: string | null
          profile_id: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_household_id?: string | null
          locale?: string
          onboarding_completed_at?: string | null
          profile_id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_household_id?: string | null
          locale?: string
          onboarding_completed_at?: string | null
          profile_id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_household_id_fkey"
            columns: ["default_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_check_activation: {
        Args: { p_code: string; p_username: string }
        Returns: string
      }
      auth_complete_activation: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      auth_issue_activation: {
        Args: {
          p_code: string
          p_issued_by?: string
          p_profile_id: string
          p_valid_for?: string
        }
        Returns: string
      }
      auth_throttle_clear: { Args: { p_keys: string[] }; Returns: undefined }
      auth_throttle_locked_until: {
        Args: { p_keys: string[] }
        Returns: string
      }
      auth_throttle_register_failure: {
        Args: { p_keys: string[] }
        Returns: undefined
      }
      ensure_recurring_transactions: {
        Args: { p_household_id: string }
        Returns: number
      }
      restore_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      soft_delete_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending_activation" | "active" | "disabled"
      app_permission:
        | "finance.view"
        | "finance.create"
        | "finance.edit"
        | "finance.delete"
        | "planning.manage"
        | "members.manage"
        | "household.manage"
      goal_kind: "general" | "emergency_reserve"
      goal_status: "active" | "achieved" | "archived"
      household_role: "owner" | "admin" | "member" | "viewer"
      investment_entry_kind: "contribution" | "withdrawal" | "balance_update"
      investment_type:
        | "savings"
        | "fixed_income"
        | "treasury"
        | "stocks"
        | "real_estate_funds"
        | "funds"
        | "crypto"
        | "pension"
        | "other"
      member_status: "active" | "inactive"
      notification_type:
        | "transaction_created"
        | "transaction_updated"
        | "transaction_deleted"
        | "budget_updated"
        | "budget_threshold"
        | "bill_due"
        | "goal_reached"
        | "member_joined"
        | "system"
      payment_method_type:
        | "cash"
        | "debit_card"
        | "credit_card"
        | "pix"
        | "bank_transfer"
        | "bank_slip"
        | "meal_voucher"
        | "other"
      record_visibility: "household" | "private"
      recurrence_frequency: "weekly" | "monthly" | "yearly"
      transaction_kind: "income" | "expense" | "investment"
      transaction_status: "pending" | "paid"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending_activation", "active", "disabled"],
      app_permission: [
        "finance.view",
        "finance.create",
        "finance.edit",
        "finance.delete",
        "planning.manage",
        "members.manage",
        "household.manage",
      ],
      goal_kind: ["general", "emergency_reserve"],
      goal_status: ["active", "achieved", "archived"],
      household_role: ["owner", "admin", "member", "viewer"],
      investment_entry_kind: ["contribution", "withdrawal", "balance_update"],
      investment_type: [
        "savings",
        "fixed_income",
        "treasury",
        "stocks",
        "real_estate_funds",
        "funds",
        "crypto",
        "pension",
        "other",
      ],
      member_status: ["active", "inactive"],
      notification_type: [
        "transaction_created",
        "transaction_updated",
        "transaction_deleted",
        "budget_updated",
        "budget_threshold",
        "bill_due",
        "goal_reached",
        "member_joined",
        "system",
      ],
      payment_method_type: [
        "cash",
        "debit_card",
        "credit_card",
        "pix",
        "bank_transfer",
        "bank_slip",
        "meal_voucher",
        "other",
      ],
      record_visibility: ["household", "private"],
      recurrence_frequency: ["weekly", "monthly", "yearly"],
      transaction_kind: ["income", "expense", "investment"],
      transaction_status: ["pending", "paid"],
    },
  },
} as const
