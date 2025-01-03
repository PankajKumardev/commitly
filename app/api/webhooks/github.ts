import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import crypto from 'crypto';

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
  }
}

async function handlePullRequestEvent(payload: any) {
  const { action, pull_request } = payload;

  if (['opened', 'closed', 'merged'].includes(action)) {
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
  }
}

async function getUserIdByGitHubId(githubId: string) {
  const user = await prisma.user.findUnique({ where: { githubId } });
  return user?.id || undefined;
}
