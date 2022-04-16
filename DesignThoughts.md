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

## Constraints 

* AD Group and GH Team name must match 1:1

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