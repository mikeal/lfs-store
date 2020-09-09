# lfs-store

Experimental IPLD block store backed for git+lfs.

Only tested against GitHub.

Currently only supports blocks w/ SHA2-256 hashes.

Does not currently batch requests, which will be necessary for acceptable performance
since git+lfs requires 3 round trips for every write.

Needs more tests.
