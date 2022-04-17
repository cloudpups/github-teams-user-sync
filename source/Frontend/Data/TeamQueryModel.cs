using System.ComponentModel.DataAnnotations;

namespace Frontend.Data
{

    internal sealed class TeamQueryModel
    {
        private const int myGuessAtMaxNameLengthFromGitHub = 100;

        [Required]
        [StringLength(myGuessAtMaxNameLengthFromGitHub, ErrorMessage = "Name is too long.")]
        public string? OrganizationName { get; set; }
        [Required]
        [StringLength(myGuessAtMaxNameLengthFromGitHub, ErrorMessage = "Name is too long.")]
        public string? TeamName { get; set; }
    }
}
