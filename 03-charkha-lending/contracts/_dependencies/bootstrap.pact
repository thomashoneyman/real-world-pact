; https://github.com/Luzzotica/KadenaKontracts/blob/master/kda-env/bootstrap-modules/basic-guards.pact
(module basic-guards GOV
  (defcap GOV () true)

  (defconst GUARD_SUCCESS (create-user-guard (success)))
  (defconst GUARD_FAILURE (create-user-guard (failure)))

  (defun success () true)
  (defun failure () (enforce false "disabled"))
)

(define-namespace 'free basic-guards.GUARD_SUCCESS basic-guards.GUARD_SUCCESS)
(define-namespace 'user basic-guards.GUARD_SUCCESS basic-guards.GUARD_SUCCESS)
