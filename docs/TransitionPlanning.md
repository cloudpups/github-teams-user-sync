# Planning to transition from the Sync Bot?

As it stands today, the GitHub Team Sync bot performs one overarching responsibility- synchronizing GitHub Teams with an external source of truth. With that being said, there are realistically 3 "levels" of teams that this application synchronizes, and all three must be accounted for so that any transition to a different tool can succeed:

1. Management of teams at the Enterprise level
2. Management of teams at the Organization level
3. Management of teams within an Organization

## Features to support

1. Enterprise Level features
    1. Enterprise Level Security Managers
        * Given a series of GitHub Organizations, this application will create and synchronize a provided Security Manager team across all organizations.
        * Note: this Enterprise Level Security Manager team does not override Org specific Security Managers. It instead adds the Enterprise level team to the Org specific list.
    2. ~~Enterprise Level Organization Owners~~
        * Feature not yet implemented
2. Organization Level features
    1. Organization Owners
        * Synchronizes a GitHub Team that represents the Organization Owners for a particular GitHub Org, and ensures that the specific team is added as Organization Owners.
        * The sync bot is written to only allow 1 Organization Owners group.
    2. Organization Security Managers
        * Synchronizes a GitHub Team that represents the Organization Security Managers for a particular GitHub Org, and ensures that the specific team is added as Organization Security Managers.
        * An Organization may provide multiple Security Manager teams to synchronize.
3. Within an Organization Level features
    1. GitHub Team Sync
        * Given a list of teams, this application will synchronize said teams with an external source of truth.
    2. Display names for GitHub Teams
        * As some source of truth teams may have names not conducive for working with GitHub, this application allows users to specify a different "display name" that will be used within GitHub.
    3. Tracing
        * This application sets the Description of any GitHub Team it manages so that it is clear where the source of the information is coming from.
    4. Copilot Enablement
        * This application provides a mechanism in which users can "enable" GitHub Copilot for a particular team.

## Suggested Transition Plan

As a successful and painless transition between tools is very dependent on proper preparation, I provide the following list of items to consider when planning your own transition:

1. Announce well ahead of time that the mechanism in which GitHub Teams are managed will be changing. 
    * Include a date if possible.
2. Ensure the tool you are transitioning to has *at least* the features [listed above](#Features-to-support).
    * If it does not, you must either implement those features yourself, or include in your plan what consumers of your tool should do instead.
    * For example, if your tool does not support display names, you must clearly communicate this and provide a clear transition plan for those two who currently use Display Names.
3. Create and test a "transition script." This script should fully automate the transition of any particular GitHub Organization to the new way of managing GitHub Teams, including, but not limited to, the following steps:
    1. MANUAL STEP: work with Organization Owners to disable the Team Sync Bot during the transition.
    2. Import existing Sync Bot managed teams into the new management tool (as a "draft," if possible, so as not to disrupt current team syncs during the transition). This can be done via scanning the org config file. Once confidence is gained in the new tool properly managing the existing teams, move on to the next step.
    3. Update the existing Team Sync Options file so that it contains a single commented line that explains how members of the Organization should now manage their team.
        * This is important as many may miss the transition announcement. By adding a comment to the configuration file many are used to, this will help catch those who missed the original announcement.

## Bonus Points

* Everyone learns and consumes information differently. *Before* transitioning to the new tool, supporting documentation must be created so that how to use it is clear. Bonus points if a video demonstration is included (again, everyone learns differently).
    
