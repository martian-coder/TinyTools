'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.MEMORY_TABLE || 'MemoraMemory';
const MAX_HISTORY_TURNS = 20;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function getMemory(userId) {
  const result = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId },
  }));
  if (!result.Item) {
    return { history: [], facts: [] };
  }
  return {
    history: result.Item.history || [],
    facts: result.Item.facts || [],
  };
}

async function saveMemory(userId, history, facts) {
  // Keep only the most recent turns to avoid unbounded growth
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);
  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      history: trimmedHistory,
      facts,
      updatedAt: new Date().toISOString(),
    },
  }));
}

module.exports = { getMemory, saveMemory };
