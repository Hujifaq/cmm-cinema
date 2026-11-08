namespace CMM_Cinema.Models
{
    public record ProfileViewModel(
        string Name,
        string Subtitle,
        string IdentifierLabel,
        string Identifier,
        bool? EmailVerified,
        IReadOnlyList<string> Methods)
    {
        public string Initial => Name.Trim() is { Length: > 0 } name ? name[..1].ToUpperInvariant() : "?";
    }
}
