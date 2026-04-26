/**
 * Contract returned by POST /simulate. Action-based model (MiroFish-inspired). Frontend (P2 graph, P3 results+feed) builds against this shape.
 */
export interface SimulationResult {
  /**
   * Stable id, e.g. 'rto_v1' or 'rto_v2'. Used for caching.
   */
  scenario_id: string;
  /**
   * Which version of the policy this is. Drives compare view.
   */
  policy_version: "v1" | "v2";
  /**
   * Echo of the input policy for display
   */
  policy_text?: string;
  /**
   * Output of the policy parser, surfaced for transparency
   */
  parsed_policy?: {
    scenario_type?: string;
    category?: string;
    summary?: string;
    tone?: string;
    severity?: number;
    dimensions_affected?: string[];
    [k: string]: unknown;
  };
  model_version?: string;
  baseline: {
    enps: number;
    /**
     * 0-1 scale
     */
    engagement: number;
    trust: number;
    intent_to_stay: number;
    [k: string]: unknown;
  };
  predicted: {
    enps: number;
    engagement: number;
    trust: number;
    intent_to_stay: number;
    confidence: "high" | "medium" | "low";
    /**
     * @minItems 2
     * @maxItems 2
     */
    confidence_interval_enps?: [number, number];
    [k: string]: unknown;
  };
  /**
   * Time-ordered list of every action taken during the 30-day simulation. Drives BOTH the live action feed (P3) and the graph edge animations (P2). Sorted by day ascending, then by intra-day order.
   */
  actions: {
    /**
     * Stable unique id for keying React lists. Format: 'act_d{day}_{seq}'
     */
    id: string;
    day: number;
    /**
     * Order within the day. Used for animation pacing.
     */
    intra_day_order?: number;
    /**
     * Acting agent's id from northwind.json
     */
    agent_id: string;
    action_type:
      | "VENT_TO_PEER"
      | "POST_IN_CHANNEL"
      | "MESSAGE_MANAGER"
      | "GO_QUIET"
      | "UPDATE_LINKEDIN"
      | "ADVOCATE"
      | "REQUEST_EXCEPTION"
      | "DO_NOTHING";
    /**
     * Who/what the action is directed at. Shape varies by action_type.
     */
    target?: {
      type?: "agent" | "channel" | "manager" | "external" | "none";
      /**
       * agent_id for 'agent', channel name like '#engineering' for 'channel', manager's agent_id for 'manager', etc.
       */
      value?: string;
      [k: string]: unknown;
    };
    /**
     * What the agent said/wrote. First-person voice. Empty string for GO_QUIET / DO_NOTHING / UPDATE_LINKEDIN.
     */
    content?: string;
    /**
     * Strength of the action. Higher = more dramatic visual effect.
     */
    intensity: number;
    /**
     * agent_ids who observe this action. Drives sentiment spread and the visible audience for animations.
     */
    is_visible_to?: string[];
    /**
     * Computed deltas applied as a result of this action.
     */
    sentiment_impact?: {
      actor_delta?: number;
      observer_delta?: number;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  }[];
  /**
   * Aggregate counts by action_type across the whole simulation. Drives compare view headline numbers.
   */
  action_volume_summary?: {
    VENT_TO_PEER?: number;
    POST_IN_CHANNEL?: number;
    MESSAGE_MANAGER?: number;
    GO_QUIET?: number;
    UPDATE_LINKEDIN?: number;
    ADVOCATE?: number;
    REQUEST_EXCEPTION?: number;
    DO_NOTHING?: number;
    [k: string]: unknown;
  };
  /**
   * 30 daily snapshots of derived agent state. Sentiment is computed from cumulative action impacts, not LLM-assigned. P2's graph color uses this; action animations use the actions[] array.
   *
   * @minItems 30
   * @maxItems 30
   */
  snapshots: [
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    },
    {
      day: number;
      /**
       * One entry per agent, same length as northwind.json agents array
       */
      agent_states: {
        agent_id: string;
        /**
         * 0-1 scale. <0.4 red, 0.4-0.6 yellow, >0.6 green
         */
        sentiment: number;
        /**
         * True if agent took an action this day. Drives pulse animation.
         */
        is_active_today: boolean;
        /**
         * True if agent has UPDATE_LINKEDIN action by this day
         */
        flight_risk_flag?: boolean;
        [k: string]: unknown;
      }[];
      aggregate_sentiment?: number;
      actions_today_count?: number;
      [k: string]: unknown;
    }
  ];
  /**
   * Department × location heat map rows.
   */
  cohort_metrics: {
    cohort_label: string;
    department: string;
    location?: string;
    headcount: number;
    baseline_sentiment?: number;
    predicted_sentiment?: number;
    sentiment_delta: number;
    enps_delta: number;
    top_concern: string;
    risk_level: "high" | "medium" | "low";
    /**
     * Number of agents in this cohort with UPDATE_LINKEDIN action
     */
    flight_risk_count?: number;
    /**
     * Most frequent action_type in this cohort, useful for narrative summaries
     */
    loudest_action_type?: string;
    [k: string]: unknown;
  }[];
  /**
   * Top 3 concern clusters extracted from action.content strings. Quotes are real action.content values, not generated separately.
   *
   * @minItems 1
   * @maxItems 5
   */
  themes:
    | [
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        }
      ]
    | [
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        }
      ]
    | [
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        }
      ]
    | [
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        }
      ]
    | [
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        },
        {
          label: string;
          description?: string;
          /**
           * Number of actions whose content maps to this theme
           */
          volume: number;
          volume_pct?: number;
          /**
           * Top 2-3 representative quotes pulled directly from action.content fields
           */
          quotes: {
            text: string;
            agent_id: string;
            /**
             * Reference back to the originating action, lets UI link back to feed
             */
            action_id: string;
            department?: string;
            role?: string;
            [k: string]: unknown;
          }[];
          departments_affected?: string[];
          [k: string]: unknown;
        }
      ];
  recommendation: {
    title: string;
    rationale: string;
    /**
     * Pre-fills the v2 policy editor when 'Apply' is clicked
     */
    suggested_rewrite: string;
    projected_impact: {
      negative_action_reduction_pct?: number;
      linkedin_updates_avoided?: number;
      engagement_lift?: number;
      confidence?: "high" | "medium" | "low";
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  /**
   * Executive 1-liner shown at top of results
   */
  summary?: string;
  computed_at?: string;
  computation_ms?: number;
  /**
   * True if heuristic fallback was used for any agent due to LLM failure. Surfaces in low-confidence label.
   */
  fallback_used?: boolean;
  [k: string]: unknown;
}
