namespace CMM_Cinema.Models;

public record NewsItem(string Title, 
string Category, 
string Date, 
string Image, 
string Excerpt, 
string Url);

public record NewsSectionViewModel(string Id, 
string Title, 
IReadOnlyList<NewsItem> Items);
