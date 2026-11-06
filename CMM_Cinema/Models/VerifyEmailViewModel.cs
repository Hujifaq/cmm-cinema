namespace CMM_Cinema.Models
{
    public class VerifyEmailViewModel
    {
        public string Token { get; set; } = string.Empty;

        public bool IsValid { get; set; }

        public string Email { get; set; } = string.Empty;
    }
}
