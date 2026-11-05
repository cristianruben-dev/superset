/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/** One event of a stream of server-sent events. */
export interface SseEvent {
  event: string;
  data: string;
}

function eventOf(lines: string[]): SseEvent | null {
  let event = 'message';
  const data: string[] = [];
  lines.forEach(line => {
    // A comment only keeps the connection open
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    if (field === 'data') data.push(value);
  });
  return data.length ? { event, data: data.join('\n') } : null;
}

/**
 * Reads server-sent events from text as it arrives: each call takes the next chunk,
 * cut anywhere, and returns the events it completed.
 */
export function sseParser(): (chunk: string) => SseEvent[] {
  let buffer = '';
  return chunk => {
    buffer = (buffer + chunk).replace(/\r\n/g, '\n');
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    return blocks
      .map(block => eventOf(block.split('\n')))
      .filter((event): event is SseEvent => event !== null);
  };
}
