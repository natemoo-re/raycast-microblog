import { ActionPanel, Form, showToast, Action, Toast, getPreferenceValues, popToRoot, closeMainWindow, showHUD } from "@raycast/api";
import { useState } from "react";
import { Octokit } from 'octokit';
// @ts-expect-error missing types
import { unique as uuid } from 'shorthash';

const NAMESPACE = `39b1bb9f-e55c-4fdd-8fc2-8d39bf03e217`;

interface Preferences {
  github_token: string;
  repo: string;
}

interface PostForm {
  body?: string;
}

function createPost(body = '') {
  const date = new Date();
  const iso = `${date.toISOString().slice(0,-5)}Z`;
  const id = uuid(`${NAMESPACE}:${body}:${iso}`).padStart(7, '0');
  return {
    id,
    filename: `${iso.split('T')[0].replace(/-/g, '/')}/${id}.md`,
    contents: `---
date: ${iso}
---
${body}
`
  }
}

let octokit: Octokit;

export default function Command() {
  const [bodyError, setBodyError] = useState<string | undefined>();
  function dropBodyErrorIfNeeded() {
    if (bodyError && bodyError.length > 0) {
      setBodyError(undefined);
    }
  }
  function validateBody(value?: string) {
    if (!value?.trim()) {
      setBodyError(`Value is required!`);
      return false;
    } else {
      dropBodyErrorIfNeeded()
      return true;
    }
  }

  async function handleSubmit(values: PostForm) {
    const valid = validateBody(values.body);
    if (!valid) return
    const post = createPost(values.body);
    const preferences = getPreferenceValues<Preferences>();
    const [owner, repo] = preferences.repo.split('/')

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Commiting post to GitHub...",
    });

    console.log(post);

    try {
      if (!octokit) {
        octokit = new Octokit({
          auth: preferences.github_token
        })
      }
      
      await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: `posts/${post.filename}`,
        message: `create ${post.id}.md`,
        committer: {
          name: 'Microblog',
          email: 'microblog-extension[bot]@github.com'
        },
        content: Buffer.from(post.contents).toString('base64')
      })

      await popToRoot();
      await closeMainWindow();
      await showHUD(`Post created`);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Unable to commit post";
      toast.message = String(error);
    }
  }


  return (
    <Form
      navigationTitle="Microblog"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="body"
        title="Post"
        placeholder="What's happening"
        autoFocus
        enableMarkdown
        error={bodyError}
        onChange={dropBodyErrorIfNeeded}
        onBlur={(event) => validateBody(event.target.value)}
      />
    </Form>
  );
}
