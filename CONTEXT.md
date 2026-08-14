# NotebookLM-Clone

NotebookLM-Clone is a source-grounded research workspace. Its language distinguishes shared research material from each guest's private conversation and notes.

## Research workspace

**Notebook**:
A named research workspace that groups sources and provides the context for a conversation and notes.
_Avoid_: Project, workspace

**Example Notebook**:
A read-only notebook whose sources are available to every admitted guest while conversations and notes remain private to each guest.
_Avoid_: Demo project, sample workspace

**Source**:
A PDF or pasted text added to a notebook as research material.
_Avoid_: Document, file

**Passage**:
A location-aware portion of a source that can be retrieved as evidence for an answer.
_Avoid_: Chunk, segment

## Research activity

**Conversation**:
The private, persistent sequence of questions and answers belonging to one guest in one notebook. A guest has at most one conversation per notebook.
_Avoid_: Chat, thread

**Question**:
A guest's request for an answer grounded in the sources of a notebook.
_Avoid_: Prompt, query

**Answer**:
An assistant response derived from retrieved passages and stored in a conversation.
_Avoid_: Completion, generation

**Citation**:
A validated reference from an answer to one retrieved passage, including the passage's source location.
_Avoid_: Link, reference

**Note**:
A private item a guest saves from an answer for later use within a notebook.
_Avoid_: Bookmark, highlight

## Access and processing

**Guest**:
A person represented by an anonymous authenticated identity and tied to the current browser session.
_Avoid_: Anonymous user, account

**Processing Stage**:
The persisted point a source has reached while becoming available for grounded questions: uploaded, extracting, chunking, embedding, ready, or failed.
_Avoid_: Job status, upload status
