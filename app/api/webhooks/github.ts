import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import crypto from 'crypto';
import { generateGeminiMessage } from '../../../lib/gemini'; // Import Gemini function

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

function validateSignature(
  payload: string,
  signature: string | string[] | undefined
) {
  if (!signature || typeof signature !== 'string') return false;
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'] as string;

  const isValid = validateSignature(JSON.stringify(req.body), signature);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    switch (event) {
      case 'issues':
        await handleIssueEvent(req.body);
        break;
      case 'pull_request':
        await handlePullRequestEvent(req.body);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
        return res.status(400).json({ error: `Unhandled event: ${event}` });
    }

    res.status(200).json({ message: 'Event handled successfully' });
  } catch (error) {
    console.error('Error handling event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function handleIssueEvent(payload: any) {
  const { action, issue } = payload;

  if (action === 'opened' || action === 'closed') {
    // Generate a Gemini message based on the issue
    const prompt = `Please summarize the following issue and provide any recommendations: ${issue.title} - ${issue.body}`;
    const geminiMessage = await generateGeminiMessage(prompt);

    // Upsert the issue into the database
    await prisma.issue.upsert({
      where: { id: issue.id },
      create: {
        id: issue.id,
        title: issue.title,
        description: issue.body,
        status: action === 'opened' ? 'Open' : 'Closed',
        userId:
          (await getUserIdByGitHubId(issue.user.id)) ??
          (() => {
            throw new Error('User not found');
          })(),
      },
      update: { status: action === 'opened' ? 'Open' : 'Closed' },
    });

    // Optionally: post the Gemini message as a comment in the GitHub issue (if necessary)
    if (geminiMessage) {
      await postGitHubComment(
        issue.number,
        issue.repository.full_name,
        geminiMessage
      );
    }
  }
}

async function handlePullRequestEvent(payload: any) {
  const { action, pull_request } = payload;

  if (['opened', 'closed', 'merged'].includes(action)) {
    // Generate a Gemini message based on the pull request
    const prompt = `Summarize the following pull request and provide a recommendation: ${pull_request.title} - ${pull_request.body}`;
    const geminiMessage = await generateGeminiMessage(prompt);

    // Upsert the pull request into the database
    await prisma.pullRequest.upsert({
      where: { id: pull_request.id },
      create: {
        id: pull_request.id,
        title: pull_request.title,
        description: pull_request.body,
        status:
          action === 'opened'
            ? 'Open'
            : action === 'closed'
            ? 'Closed'
            : 'Merged',
        merged: action === 'merged',
        userId:
          (await getUserIdByGitHubId(pull_request.user.id)) ??
          (() => {
            throw new Error('User not found');
          })(),
      },
      update: {
        status:
          action === 'opened'
            ? 'Open'
            : action === 'closed'
            ? 'Closed'
            : 'Merged',
        merged: action === 'merged',
      },
    });

    // Optionally: post the Gemini message as a comment in the GitHub pull request (if necessary)
    if (geminiMessage) {
      await postGitHubComment(
        pull_request.number,
        pull_request.repository.full_name,
        geminiMessage
      );
    }
  }
}

async function getUserIdByGitHubId(githubId: string) {
  const user = await prisma.user.findUnique({ where: { githubId } });
  return user?.id || undefined;
}

// Example function to post a comment to GitHub (use fetch or axios to make API requests to GitHub)
async function postGitHubComment(
  issueOrPrNumber: number,
  repositoryFullName: string,
  comment: string
) {
  const url = `https://api.github.com/repos/${repositoryFullName}/issues/${issueOrPrNumber}/comments`;
  const accessToken = process.env.GITHUB_ACCESS_TOKEN;

  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: comment }),
  });
}
