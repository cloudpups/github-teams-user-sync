# Design Thoughts

Would be nice to just leverage IDP...

For simplicity- no true persistent data.

## Configuration Items

* string: AD Group
    * Tenant to query
    * Query Client
        * Id
        * Secret
* config (minutes): minimum sync interval per team
    * 10 minutes default
    * 5 minute minimum
* config (cron): sync request check interval
    * 1 minute minimum
    * 5 minute default
* config (email): support email to display
* string list: list of teams to sync
    * Ideally these teams would have no direct maintainers as they only exist to sync membership with AD groups
    * Perhaps require that this bot creates the teams?

## Constraints 

* AD Group and GH Team name must match 1:1
* This bot WILL NOT designate owners.
    * As of this point in time, the author is taking the stance that Ownership of the organization should be a fully human decision OR a decision left up to a different entity.
    * At least as of this point in time, I do not want to risk a situation in which this bot could remove all owners of an org (besides itself, somehow).
* This bot WILL be able to remove any member who is NOT an owner and is not part of a team it manages
    * Allow this functionality to be toggled on and off
    * Will NOT remove owners

## Cache

* team name --> time since last sync
    * if sync is attempted and time since last sync is smaller than minimum sync interval, add event back to end of queue with retry counter

## Triggers for Sync

* AD Group Changed
    * AD Events published to queue for resiliency.    
    * Sets "RequestsUpdate" on AD group to true
* GitHub Teams Config File Changed
    * Teams file changes published to queue for resiliency.
    * Sets "RequestsUpdate" on GitHub group to true
* Bot Started
    * Needs to first get all orgs the bot is installed in. This would be a good candidate for persistence...
    * Saves list of orgs to cache
    * Pulls all Teams config files into cache
    * Generate org+team+adgroup graph
    * Publish team+adgroup name to processing queue


Permissions Needed:

* Create team: https://docs.github.com/en/rest/reference/teams#create-a-team
* List team members: https://docs.github.com/en/rest/reference/teams#list-team-members 
* Create organization invitation: https://docs.github.com/en/rest/reference/orgs#create-an-organization-invitation    
* Add org member to team: https://docs.github.com/en/rest/reference/teams#add-or-update-team-membership-for-a-user
* Remove team membership: https://docs.github.com/en/rest/reference/teams#remove-team-membership-for-a-user