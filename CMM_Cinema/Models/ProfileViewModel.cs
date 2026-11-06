namespace CMM_Cinema.Models
{
    public record ProfileViewModel(User User, IReadOnlyList<string> LoginProviders)
    {
        public string Initial => User.Name.Trim() is { Length: > 0 } name ? name[..1].ToUpperInvariant() : "?";
    }
}
