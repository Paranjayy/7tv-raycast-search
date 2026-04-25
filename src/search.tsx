import { List, Grid, ActionPanel, Action, Icon, showToast, Toast, Image } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Emote {
  id: string;
  name: string;
  owner?: {
    display_name: string;
  };
  data: {
    host: {
      url: string;
      files: { name: string; static_name: string; width: number; height: number }[];
    };
  };
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<Emote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGridView, setIsGridView] = useState(true);

  useEffect(() => {
    async function fetchEmotes() {
      const query = searchText.trim();
      
      setIsLoading(true);
      try {
        // Switching to GraphQL (GQL) which is the official and most stable v3 search method
        // This avoids the 'invalid id' error that occurs on some GET endpoints
        const gqlQuery = {
          query: `
            query SearchEmotes($query: String!, $page: Int, $limit: Int) {
              emotes(query: $query, page: $page, limit: $limit, sort: "TOP") {
                count
                items {
                  id
                  name
                  owner {
                    display_name
                  }
                  data {
                    host {
                      url
                      files {
                        name
                        static_name
                        width
                        height
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: {
            query: query || "", // Empty query for trending/top
            page: 1,
            limit: 50
          }
        };

        const response = await fetch("https://7tv.io/v3/gql", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "User-Agent": "Raycast/1.0.0 (Antigravity-Vault)" 
          },
          body: JSON.stringify(gqlQuery)
        });
        
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API ${response.status}: ${errBody.slice(0, 50)}`);
        }
        
        const resJson = (await response.json()) as any;
        if (resJson.errors) {
            throw new Error(resJson.errors[0]?.message || "GQL Error");
        }

        setItems(resJson.data?.emotes?.items || []);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "7TV Error",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
        fetchEmotes();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  const toggleViewAction = (
    <Action
      title={isGridView ? "Switch to List View" : "Switch to Grid View"}
      icon={isGridView ? Icon.List : Icon.Grid}
      onAction={() => setIsGridView(!isGridView)}
      shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
    />
  );

  const renderActions = (item: Emote, emoteUrl: string) => (
    <ActionPanel>
      <ActionPanel.Section>
        <Action.CopyToClipboard title="Copy Emote URL" content={emoteUrl} />
        <Action.Paste title="Paste Emote URL" content={emoteUrl} />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.OpenInBrowser title="View on 7TV" url={`https://7tv.app/emotes/${item.id}`} />
        {toggleViewAction}
        <Action.CopyToClipboard title="Copy ID" content={item.id} shortcut={{ modifiers: ["cmd", "shift"], key: "i" }} />
      </ActionPanel.Section>
    </ActionPanel>
  );

  if (isGridView) {
    return (
      <Grid
        isLoading={isLoading}
        onSearchTextChange={setSearchText}
        searchBarPlaceholder="Search 7TV Emotes (Grid Mode)..."
        columns={6}
        fit={Grid.Fit.Contain}
      >
        <Grid.Section title={searchText ? `Results for "${searchText}"` : "Top Emotes"}>
          {items.map((item) => {
            const hostUrl = item.data.host.url;
            const emoteUrl = `https:${hostUrl}/2x.webp`;
            return (
              <Grid.Item
                key={item.id}
                title={item.name}
                subtitle={item.owner?.display_name}
                content={{ source: emoteUrl }}
                actions={renderActions(item, emoteUrl)}
              />
            );
          })}
        </Grid.Section>
      </Grid>
    );
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search 7TV Emotes (List Mode)..."
      throttle
    >
      <List.Section title={searchText ? `Results for "${searchText}"` : "Top Emotes"}>
        {items.map((item) => {
          const hostUrl = item.data.host.url;
          const emoteUrl = `https:${hostUrl}/2x.webp`;
          return (
            <List.Item
              key={item.id}
              title={item.name}
              subtitle={item.owner?.display_name || "Community"}
              icon={{ source: emoteUrl, mask: Image.Mask.RoundedRect }}
              actions={renderActions(item, emoteUrl)}
            />
          );
        })}
      </List.Section>
    </List>
  );
}
