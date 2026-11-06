namespace CMM_Cinema.Models
{
    public class AuthPageViewModel
    {
        public string Mode { get; set; } = "login";

        public string? Notice { get; set; }

        public bool NoticeIsError { get; set; }

        public string? ReturnUrl { get; set; }

        public LoginViewModel Login { get; set; } = new();

        public RegisterViewModel Register { get; set; } = new();
    }
}
