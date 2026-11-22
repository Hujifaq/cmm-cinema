namespace CMM_Cinema.Models;

public sealed record User(
    int Id,
    string Email,
    string Name,
    string? PasswordHash,
    bool EmailVerified,
    int FailedLogins,
    DateTimeOffset? LockoutUntil,
    string SecurityStamp)
{
    public bool HasPassword => PasswordHash is not null;

    public bool IsLockedOut(DateTimeOffset now) => LockoutUntil > now;
}

public sealed record UserContact(string Name, string Email)
{
    public bool IsAdminAccount => Email.EndsWith("@cmm-cinema.invalid", StringComparison.OrdinalIgnoreCase);
    public string DisplayEmail => IsAdminAccount ? "Admin booking account" : Email;
}
