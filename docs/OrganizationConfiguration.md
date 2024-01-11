# Organization Configuration

This service/Action requires that a configuration file be present in the `.github` repository of your GitHub Organization. An example of this is show below:

Filename: `team-sync-options.yaml`
```yaml
# This property is used to set the Owners of the Organization. Currently, this will NOT 
# remove anyone who was manually added as an Owner to the org.
OrganizationOwnersGroup: Some_Org_Owner_Group

# This property is used to control the addition of general Members to your Organization.
OrganizationMembersGroup: Some_Group_To_Sync_For_Organization_Membership

# This property is used for syncing all other GitHub Teams. Please note that users must also 
# be a part of the `OrganizationMembersGroup` for the synchronization of the teams below to 
# function properly.
# Note: this is a convenience property. The `Teams` property allows for more complex
# setup of teams (i.e., display names and eventually parent/child relationships).
GitHubTeamNames:
- Some_Team_To_Sync
- Some_Other_Team_To_Sync

# Allows Organizations to add their own Security Manager teams in addition to those set at 
# the app level. 
# Note: this property supports Display Names.
AdditionalSecurityManagerGroups:
- Name: Some_SecurityManager_Team
- Name: Some_SecurityManager_Team_2
  DisplayName: Some Security Manager Team 2

# This property is used for syncing all other GitHub Teams. Please note that users must also 
# be a part of the `OrganizationMembersGroup` for the synchronization of the teams below to 
# function properly.
# Note: this property supports Display Names.
Teams:
- Name: Some_Team
- Name: Some_Team_2
  DisplayName: Some Team 2
  # An optional property that adds the given team to the list of those Copilot licenses are 
  # granted to.
  CopilotEnabled: true
```