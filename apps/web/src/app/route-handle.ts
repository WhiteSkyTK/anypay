/** Per-route UI flags, declared on the route (`handle`) and read by the shell via useMatches. */
export interface RouteHandle {
  tabBar?: boolean
}

export const withTabBar: RouteHandle = { tabBar: true }
